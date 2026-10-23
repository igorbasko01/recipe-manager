import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../../tool/web_assets.dart';

void main() {
  late Map<String, dynamic> manifest;

  setUpAll(() {
    manifest = jsonDecode(File('web/manifest.json').readAsStringSync())
        as Map<String, dynamic>;
  });

  test('manifest start_url and scope are the site root', () {
    expect(manifest['start_url'], '/');
    expect(manifest['scope'], '/');
  });

  test('every manifest icon exists, including a maskable one', () {
    final icons = (manifest['icons'] as List).cast<Map<String, dynamic>>();
    expect(icons, isNotEmpty);
    for (final icon in icons) {
      expect(File('web/${icon['src']}').existsSync(), isTrue,
          reason: '${icon['src']} is missing');
    }
    expect(icons.any((icon) => icon['purpose'] == 'maskable'), isTrue);
  });

  test('CNAME points at the custom domain', () {
    expect(File('web/CNAME').readAsStringSync().trim(), 'recipes.baskorp.com');
  });

  test('.nojekyll exists', () {
    expect(File('web/.nojekyll').existsSync(), isTrue);
  });

  test('index.html keeps the base href placeholder', () {
    expect(File('web/index.html').readAsStringSync(),
        contains('<base href="\$FLUTTER_BASE_HREF">'));
  });

  group('vendored web assets', () {
    const fix = 'run `dart run tool/update_web_assets.dart`';
    late Map<String, dynamic> recorded;

    setUpAll(() {
      recorded = jsonDecode(File(manifestPath).readAsStringSync())
          as Map<String, dynamic>;
    });

    test('the manifest lists exactly the vendored assets', () {
      expect(recorded.keys.toSet(), vendoredAssets.keys.toSet(), reason: fix);
    });

    for (final MapEntry(key: file, value: asset) in vendoredAssets.entries) {
      test('web/$file matches the locked ${asset.package} version', () {
        final entry = recorded[file] as Map<String, dynamic>?;
        expect(entry, isNotNull, reason: '$file is not in $manifestPath; $fix');
        expect(entry!['package'], asset.package, reason: fix);
        expect(entry['version'], lockedVersion(asset.package),
            reason: 'web/$file was fetched for ${asset.package} '
                '${entry['version']}, but pubspec.lock has '
                '${lockedVersion(asset.package)}; $fix');
        final local = File('web/$file');
        expect(local.existsSync(), isTrue, reason: 'web/$file is missing; $fix');
        expect(sha256Hex(local.readAsBytesSync()), entry['sha256'],
            reason: 'web/$file does not match its recorded sha256; $fix');
      });
    }
  });
}
