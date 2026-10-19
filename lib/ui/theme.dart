import 'package:flutter/material.dart';

/// Warm neutral palette, carried over from the React app.
const lightBackground = Color(0xFFFAF8F4);
const darkBackground = Color(0xFF16150F);

/// Terracotta of the app icon; seeds the Material 3 color scheme.
const _seed = Color(0xFFB4532A);

ThemeData buildTheme(Brightness brightness) {
  final background =
      brightness == Brightness.light ? lightBackground : darkBackground;
  final scheme = ColorScheme.fromSeed(
    seedColor: _seed,
    brightness: brightness,
  ).copyWith(surface: background);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,
  );
}
