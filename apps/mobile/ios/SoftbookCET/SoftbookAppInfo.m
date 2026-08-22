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

  return @{
    @"platform" : @"ios",
    @"version" : version
  };
}

@end
