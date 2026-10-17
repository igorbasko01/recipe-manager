import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/ui/app.dart';

void main() {
  testWidgets('shows the Recipes home page', (tester) async {
    await tester.pumpWidget(const RecipesApp());

    expect(find.text('Recipes'), findsOneWidget);
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.title, 'Recipes');
    expect(app.themeMode, ThemeMode.system);
  });
}
