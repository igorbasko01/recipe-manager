import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

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
}
