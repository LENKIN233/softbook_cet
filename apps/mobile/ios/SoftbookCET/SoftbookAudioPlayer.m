#import <AVFoundation/AVFoundation.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

static NSString *const SoftbookAudioPlayerEvent = @"SoftbookAudioPlayerEvent";

@interface SoftbookAudioPlayer : RCTEventEmitter <AVAudioPlayerDelegate>
@property(nonatomic, strong) AVAudioPlayer *player;
@property(nonatomic, copy) NSString *playbackToken;
@property(nonatomic, assign) BOOL hasListeners;
@end

@implementation SoftbookAudioPlayer

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
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

  [self stopPlayer];
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
    reject(@"audio_session_failed", @"Audio session is unavailable.", sessionError);
    return;
  }

  NSError *playerError = nil;
  AVAudioPlayer *player = [[AVAudioPlayer alloc] initWithContentsOfURL:fileURL
                                                                 error:&playerError];
  if (player == nil || playerError != nil || ![player prepareToPlay]) {
    [self deactivateAudioSession];
    reject(@"audio_prepare_failed", @"Audio preparation failed.", playerError);
    return;
  }

  player.delegate = self;
  self.playbackToken = playbackToken;
  self.player = player;
  resolve(nil);
}

RCT_EXPORT_METHOD(play:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.player == nil || ![self.player play]) {
    reject(@"audio_not_ready", @"Audio is not ready.", nil);
    return;
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
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
  if (typeValue.unsignedIntegerValue == AVAudioSessionInterruptionTypeBegan && self.player.isPlaying) {
    [self.player pause];
    [self emitType:@"interruption"];
  }
}

- (void)handleApplicationBackground:(NSNotification *)notification
{
  if (self.player.isPlaying) {
    [self.player pause];
    [self emitType:@"interruption"];
  }
}

- (void)emitType:(NSString *)type
{
  if (!self.hasListeners) {
    return;
  }
  [self sendEventWithName:SoftbookAudioPlayerEvent
                     body:@{
                       @"type" : type,
                       @"playbackToken" : self.playbackToken ?: @""
                     }];
}

- (void)stopPlayer
{
  BOOL hadActivePlayer = self.player != nil || self.playbackToken.length > 0;
  [self.player stop];
  self.player.delegate = nil;
  self.player = nil;
  self.playbackToken = nil;
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
