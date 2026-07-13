Pod::Spec.new do |s|
  s.name           = 'SongseedPitchShift'
  s.version        = '0.1.0'
  s.summary        = 'Song Seed pitch shift module'
  s.description    = 'Native pitch shift module scaffold for Song Seed'
  s.author         = 'OpenAI'
  s.homepage       = 'https://openai.com'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility — required so `import SongseedPitchShift` resolves.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # The podspec already lives in ios/, so the sources are siblings — an 'ios/**'
  # prefix looked for a non-existent ios/ios/ and matched nothing (the module never
  # built on iOS because iOS was never built).
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.4'
end
