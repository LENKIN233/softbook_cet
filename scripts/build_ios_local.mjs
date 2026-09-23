#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = !process.argv.includes("--device-only");
const output = path.join(
  root,
  backend
    ? "exports/local-backend/ios-derived"
    : "exports/repair-and-build/ios-derived"
);
fs.mkdirSync(output, { recursive: true });
// Xcode embeds simulated entitlements in the simulator executable.
// This identity is local to the simulator and is not an Apple developer team.
const identifier = backend
  ? "com.softbook.cet.backend"
  : "com.softbook.cet.local";
const entitlementPath = path.join(output, "simulator.entitlements");
const identity = `local.simulator.${identifier}`;
fs.writeFileSync(
  entitlementPath,
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>application-identifier</key><string>${identity}</string><key>keychain-access-groups</key><array><string>${identity}</string></array></dict></plist>`
);
// CocoaPods can retain ImportHostCompilers.cmake after its compiler was removed.
// Xcode then skips the host build but cannot produce the JavaScript bundle.
const hermesRoot = path.join(root, "apps/mobile/ios/Pods/hermes-engine");
const hermesBuild = path.join(hermesRoot, "build_host_hermesc");
const hermesCompiler = path.join(hermesBuild, "bin/hermesc");
if (!fs.existsSync(hermesCompiler)) {
  const sdk = spawnSync("xcrun", ["--sdk", "macosx", "--show-sdk-path"], {encoding: "utf8"});
  if (sdk.status !== 0) throw new Error("Unable to resolve the macOS compiler SDK.");
  for (const args of [
    ["-S", hermesRoot, "-B", hermesBuild, "-DCMAKE_BUILD_TYPE=Release",
      `-DCMAKE_OSX_SYSROOT=${sdk.stdout.trim()}`,
      `-DJSI_DIR=${path.join(root, "apps/mobile/node_modules/react-native/ReactCommon/jsi")}`],
    ["--build", hermesBuild, "--target", "hermesc", "--parallel", "2"],
  ]) {
    const build = spawnSync("cmake", args, {cwd: root, stdio: "inherit"});
    if (build.status !== 0) process.exit(build.status ?? 1);
  }
  if (!fs.existsSync(hermesCompiler)) throw new Error("Hermes compiler was not produced.");
}
const result = spawnSync(
  "xcodebuild",
  [
    "-workspace",
    path.join(root, "apps/mobile/ios/SoftbookCET.xcworkspace"),
    "-scheme",
    "SoftbookCET",
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-destination",
    "generic/platform=iOS Simulator",
    "-derivedDataPath",
    output,
    "-jobs",
    "2",
    "CODE_SIGNING_ALLOWED=YES",
    "CODE_SIGN_IDENTITY=-",
    `CODE_SIGN_ENTITLEMENTS=${entitlementPath}`,
    "IPHONEOS_DEPLOYMENT_TARGET=15.1",
    backend
      ? "PRODUCT_BUNDLE_IDENTIFIER=com.softbook.cet.backend"
      : "PRODUCT_BUNDLE_IDENTIFIER=com.softbook.cet.local",
    "INFOPLIST_KEY_CFBundleDisplayName=软书四六级 本地",
    backend
      ? "SWIFT_ACTIVE_COMPILATION_CONDITIONS=DEBUG SOFTBOOK_LOCAL_BACKEND"
      : "SWIFT_ACTIVE_COMPILATION_CONDITIONS=DEBUG SOFTBOOK_DEVICE_LOCAL",
    backend ? "ENTRY_FILE=index.backend.js" : "ENTRY_FILE=index.local.js",
    "FORCE_BUNDLING=1",
    "EXTRA_PACKAGER_ARGS=--dev false --minify true",
    "RCT_NO_LAUNCH_PACKAGER=1",
    "build",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_BINARY: process.execPath },
  }
);
process.exitCode = result.status ?? 1;
