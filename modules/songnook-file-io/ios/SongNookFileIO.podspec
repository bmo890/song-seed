Pod::Spec.new do |s|
  s.name           = 'SongNookFileIO'
  s.version        = '1.0.0'
  s.summary        = 'Native file passes for SongNook backups and archives'
  s.description    = 'Writes and reads stored zip archives in one native pass, hashing as it goes.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
