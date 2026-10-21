Pod::Spec.new do |s|
  s.name = 'FableVoip'
  s.version = '1.0.0'
  s.summary = 'Fable native PushKit registration and immediate CallKit reporting'
  s.description = 'Receives incoming Fable calls before the JavaScript application starts.'
  s.license = { :type => 'MIT' }
  s.author = 'Fable'
  s.homepage = 'https://github.com/expo/expo'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.dependency 'ExpoModulesCore'
  s.dependency 'RNCallKeep'
  s.source_files = '**/*.{h,m,mm,swift}'
end
