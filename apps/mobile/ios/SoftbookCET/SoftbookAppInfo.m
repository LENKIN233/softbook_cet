#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface SoftbookAppInfo : NSObject <RCTBridgeModule>
@end

@implementation SoftbookAppInfo

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary<NSString *, id> *)constantsToExport
{
  id versionValue = [[NSBundle mainBundle]
      objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString *version = [versionValue isKindOfClass:[NSString class]]
      ? (NSString *)versionValue
      : @"";
  NSURL *profileURL = [[NSBundle mainBundle]
      URLForResource:@"softbook-release-runtime-profile"
      withExtension:@"json"];
  NSString *releaseRuntimeProfileJson = @"";
  if (profileURL != nil) {
    NSData *profileData = [NSData dataWithContentsOfURL:profileURL];
    if (profileData != nil) {
      NSString *profileText = [[NSString alloc]
          initWithData:profileData
          encoding:NSUTF8StringEncoding];
      if (profileText != nil) {
        releaseRuntimeProfileJson = profileText;
      }
    }
  }

  return @{
    @"platform" : @"ios",
    @"releaseRuntimeProfileJson" : releaseRuntimeProfileJson,
    @"version" : version
  };
}

@end
