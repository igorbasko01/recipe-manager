import 'package:flutter/material.dart';

import 'theme.dart';

class RecipesApp extends StatelessWidget {
  const RecipesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recipes',
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      home: const _HomePage(),
    );
  }
}

/// Placeholder until the recipe list lands.
class _HomePage extends StatelessWidget {
  const _HomePage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recipes')),
    );
  }
}
