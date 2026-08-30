#import <AVFoundation/AVFoundation.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

static NSString *const SoftbookAudioPlayerEvent = @"SoftbookAudioPlayerEvent";

@interface SoftbookAudioPlayer : RCTEventEmitter <AVAudioPlayerDelegate>
@property(nonatomic, strong) AVAudioPlayer *player;
@property(nonatomic, copy) NSString *playbackToken;
@property(nonatomic, copy) NSString *pendingPlaybackToken;
@property(nonatomic, assign) NSUInteger playbackGeneration;
@property(nonatomic, assign) NSUInteger pendingPlaybackGeneration;
@property(nonatomic, assign) NSUInteger preparedPlaybackGeneration;
@property(nonatomic, assign) NSUInteger interruptedPlaybackGeneration;
@property(nonatomic, assign) BOOL hasListeners;
- (NSUInteger)beginPendingPreparationWithPlaybackToken:(NSString *)playbackToken;
- (BOOL)isPendingPlaybackToken:(NSString *)playbackToken
                    generation:(NSUInteger)generation;
- (BOOL)installPreparedPlayer:(AVAudioPlayer *)player
                playbackToken:(NSString *)playbackToken
                   generation:(NSUInteger)generation;
- (void)clearPendingPreparationForGeneration:(NSUInteger)generation;
- (void)cancelCurrentPlaybackForSystemInterruption;
- (void)emitType:(NSString *)type
    playbackToken:(NSString *)playbackToken
   requiresPrepare:(BOOL)requiresPrepare;
@end

@implementation SoftbookAudioPlayer

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    [center addObserver:self
               selector:@selector(handleAudioSessionInterruption:)
                   name:AVAudioSessionInterruptionNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(handleApplicationBackground:)
                   name:UIApplicationDidEnterBackgroundNotification
                 object:nil];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ SoftbookAudioPlayerEvent ];
}

- (void)startObserving
{
  self.hasListeners = YES;
}

- (void)stopObserving
{
  self.hasListeners = NO;
}

RCT_EXPORT_METHOD(prepare:(NSString *)filePath
                  playbackToken:(NSString *)playbackToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (filePath.length == 0 || playbackToken.length == 0) {
    reject(@"audio_invalid_input", @"Audio input is invalid.", nil);
    return;
  }

  NSURL *fileURL = [NSURL fileURLWithPath:filePath];
  if (![[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
    reject(@"audio_missing_file", @"Verified audio file is unavailable.", nil);
    return;
  }

  NSUInteger generation = [self beginPendingPreparationWithPlaybackToken:playbackToken];
  NSError *sessionError = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback
                  mode:AVAudioSessionModeSpokenAudio
               options:0
                 error:&sessionError];
  if (sessionError == nil) {
    [session setActive:YES error:&sessionError];
  }
  if (sessionError != nil) {
    [self clearPendingPreparationForGeneration:generation];
    reject(@"audio_session_failed", @"Audio session is unavailable.", sessionError);
    return;
  }

  if (![self isPendingPlaybackToken:playbackToken generation:generation]) {
    reject(@"audio_prepare_interrupted", @"Audio preparation was interrupted.", nil);
    return;
  }

  NSError *playerError = nil;
  AVAudioPlayer *player = [[AVAudioPlayer alloc] initWithContentsOfURL:fileURL
                                                                 error:&playerError];
  if (player == nil || playerError != nil || ![player prepareToPlay]) {
    [self clearPendingPreparationForGeneration:generation];
    reject(@"audio_prepare_failed", @"Audio preparation failed.", playerError);
    return;
  }

  if (![self installPreparedPlayer:player
                     playbackToken:playbackToken
                        generation:generation]) {
    [player stop];
    player.delegate = nil;
    reject(@"audio_prepare_interrupted", @"Audio preparation was interrupted.", nil);
    return;
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(play:(NSString *)playbackToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVAudioPlayer *player = self.player;
  NSUInteger generation = self.preparedPlaybackGeneration;
  if (player == nil ||
      generation == 0 ||
      self.playbackGeneration != generation ||
      ![self.playbackToken isEqualToString:playbackToken]) {
    reject(@"audio_not_ready", @"Audio is not ready.", nil);
    return;
  }

  NSError *sessionError = nil;
  [[AVAudioSession sharedInstance] setActive:YES error:&sessionError];
  if (sessionError != nil) {
    reject(@"audio_session_failed", @"Audio session is unavailable.", sessionError);
    return;
  }

  if (player != self.player ||
      generation != self.playbackGeneration ||
      ![self.playbackToken isEqualToString:playbackToken]) {
    reject(@"audio_prepare_interrupted", @"Audio preparation was interrupted.", nil);
    return;
  }

  if (![player play]) {
    [self deactivateAudioSession];
    reject(@"audio_not_ready", @"Audio is not ready.", nil);
    return;
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(pause:(NSString *)playbackToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.player == nil ||
      ![self.playbackToken isEqualToString:playbackToken]) {
    reject(@"audio_not_ready", @"Audio is not ready.", nil);
    return;
  }
  [self.player pause];
  resolve(nil);
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self stopPlayer];
  resolve(nil);
}

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(BOOL)flag
{
  if (player != self.player) {
    return;
  }
  [self emitType:flag ? @"ended" : @"error"];
  [self stopPlayer];
}

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error
{
  if (player == self.player) {
    [self emitType:@"error"];
    [self stopPlayer];
  }
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification
{
  NSNumber *typeValue = notification.userInfo[AVAudioSessionInterruptionTypeKey];
  if (typeValue.unsignedIntegerValue == AVAudioSessionInterruptionTypeBegan) {
    RCTExecuteOnMainQueue(^{
      [self cancelCurrentPlaybackForSystemInterruption];
    });
  }
}

- (void)handleApplicationBackground:(NSNotification *)notification
{
  RCTExecuteOnMainQueue(^{
    [self cancelCurrentPlaybackForSystemInterruption];
  });
}

- (void)emitType:(NSString *)type
{
  [self emitType:type
    playbackToken:self.playbackToken ?: @""
   requiresPrepare:NO];
}

- (void)emitType:(NSString *)type
    playbackToken:(NSString *)playbackToken
   requiresPrepare:(BOOL)requiresPrepare
{
  if (!self.hasListeners || playbackToken.length == 0) {
    return;
  }
  NSMutableDictionary *body = [@{
    @"type" : type,
    @"playbackToken" : playbackToken
  } mutableCopy];
  if (requiresPrepare) {
    body[@"requiresPrepare"] = @YES;
  }
  [self sendEventWithName:SoftbookAudioPlayerEvent
                     body:body];
}

- (NSUInteger)beginPendingPreparationWithPlaybackToken:(NSString *)playbackToken
{
  AVAudioPlayer *previousPlayer = self.player;
  BOOL hadActivePlayback = previousPlayer != nil ||
      self.playbackToken.length > 0 ||
      self.pendingPlaybackToken.length > 0;

  self.playbackGeneration += 1;
  NSUInteger generation = self.playbackGeneration;
  self.player = nil;
  self.playbackToken = nil;
  self.preparedPlaybackGeneration = 0;
  self.pendingPlaybackToken = [playbackToken copy];
  self.pendingPlaybackGeneration = generation;

  [previousPlayer stop];
  previousPlayer.delegate = nil;
  if (hadActivePlayback) {
    [self deactivateAudioSession];
  }
  return generation;
}

- (BOOL)isPendingPlaybackToken:(NSString *)playbackToken
                    generation:(NSUInteger)generation
{
  return generation != 0 &&
      self.playbackGeneration == generation &&
      self.pendingPlaybackGeneration == generation &&
      [self.pendingPlaybackToken isEqualToString:playbackToken];
}

- (BOOL)installPreparedPlayer:(AVAudioPlayer *)player
                playbackToken:(NSString *)playbackToken
                   generation:(NSUInteger)generation
{
  if (![self isPendingPlaybackToken:playbackToken generation:generation]) {
    return NO;
  }

  player.delegate = self;
  self.player = player;
  self.playbackToken = [playbackToken copy];
  self.preparedPlaybackGeneration = generation;
  self.pendingPlaybackToken = nil;
  self.pendingPlaybackGeneration = 0;
  return YES;
}

- (void)clearPendingPreparationForGeneration:(NSUInteger)generation
{
  if (generation == 0 ||
      self.playbackGeneration != generation ||
      self.pendingPlaybackGeneration != generation) {
    return;
  }

  self.playbackGeneration += 1;
  self.pendingPlaybackToken = nil;
  self.pendingPlaybackGeneration = 0;
  [self deactivateAudioSession];
}

- (void)cancelCurrentPlaybackForSystemInterruption
{
  NSString *interruptedToken = self.pendingPlaybackToken.length > 0
      ? self.pendingPlaybackToken
      : self.playbackToken;
  NSUInteger interruptedGeneration = self.pendingPlaybackGeneration != 0
      ? self.pendingPlaybackGeneration
      : self.preparedPlaybackGeneration;

  if (interruptedToken.length == 0 ||
      interruptedGeneration == 0 ||
      self.interruptedPlaybackGeneration == interruptedGeneration) {
    return;
  }

  self.interruptedPlaybackGeneration = interruptedGeneration;
  self.playbackGeneration += 1;
  AVAudioPlayer *interruptedPlayer = self.player;
  self.player = nil;
  self.playbackToken = nil;
  self.preparedPlaybackGeneration = 0;
  self.pendingPlaybackToken = nil;
  self.pendingPlaybackGeneration = 0;

  [interruptedPlayer stop];
  interruptedPlayer.delegate = nil;
  [self deactivateAudioSession];
  [self emitType:@"interruption"
    playbackToken:interruptedToken
   requiresPrepare:YES];
}

- (void)stopPlayer
{
  AVAudioPlayer *stoppedPlayer = self.player;
  BOOL hadActivePlayer = stoppedPlayer != nil ||
      self.playbackToken.length > 0 ||
      self.pendingPlaybackToken.length > 0;
  self.playbackGeneration += 1;
  self.player = nil;
  self.playbackToken = nil;
  self.preparedPlaybackGeneration = 0;
  self.pendingPlaybackToken = nil;
  self.pendingPlaybackGeneration = 0;
  [stoppedPlayer stop];
  stoppedPlayer.delegate = nil;
  if (hadActivePlayer) {
    [self deactivateAudioSession];
  }
}

- (void)deactivateAudioSession
{
  NSError *sessionError = nil;
  [[AVAudioSession sharedInstance]
      setActive:NO
      withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
      error:&sessionError];
  if (sessionError != nil) {
    RCTLogWarn(@"Softbook audio session deactivation failed: %@", sessionError.localizedDescription);
  }
}

- (void)invalidate
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [self stopPlayer];
  [super invalidate];
}

@end
