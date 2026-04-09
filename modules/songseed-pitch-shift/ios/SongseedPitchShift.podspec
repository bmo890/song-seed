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

  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.swift_version = '5.4'
end
