import 'package:clock/clock.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/features/recipes/data/recipe.dart';

void main() {
  const flour = Ingredient(amount: 1.5, unit: 'cup', name: 'flour', note: 'sifted');
  const salt = Ingredient(amount: null, unit: '', name: 'salt', note: 'to taste');
  final recipe = Recipe(
    id: 'r1',
    title: 'Bread',
    ingredients: const [flour, salt],
    steps: const ['Mix', 'Bake'],
    createdAt: 1000,
    updatedAt: 2000,
  );

  group('Ingredient', () {
    test('JSON round-trip', () {
      expect(Ingredient.fromJson(flour.toJson()), flour);
      expect(flour.toJson(),
          {'amount': 1.5, 'unit': 'cup', 'name': 'flour', 'note': 'sifted'});
    });

    test('a null amount survives the round-trip as null, not 0', () {
      final json = salt.toJson();
      expect(json.containsKey('amount'), isTrue);
      expect(json['amount'], isNull);
      expect(Ingredient.fromJson(json).amount, isNull);
    });

    test('an integer amount in JSON reads as a double', () {
      final parsed = Ingredient.fromJson(
          {'amount': 2, 'unit': '', 'name': 'eggs', 'note': ''});
      expect(parsed.amount, 2.0);
    });

    test('copyWith can clear the amount', () {
      expect(flour.copyWith(amount: () => null).amount, isNull);
      expect(flour.copyWith(name: 'rye').amount, 1.5);
    });
  });

  group('Recipe', () {
    test('JSON round-trip', () {
      final json = recipe.toJson();
      expect(json.keys,
          ['id', 'title', 'ingredients', 'steps', 'createdAt', 'updatedAt']);
      expect(Recipe.fromJson(json), recipe);
    });

    test('value equality and hashCode', () {
      final copy = Recipe.fromJson(recipe.toJson());
      expect(copy, recipe);
      expect(copy.hashCode, recipe.hashCode);
      expect(recipe.copyWith(steps: ['Mix']), isNot(recipe));
    });

    test('lists are unmodifiable', () {
      final mutable = [flour];
      final r = recipe.copyWith(ingredients: mutable, steps: ['a']);
      mutable.add(salt);
      expect(r.ingredients, [flour]);
      expect(() => r.ingredients.add(salt), throwsUnsupportedError);
      expect(() => r.steps.add('x'), throwsUnsupportedError);
      final parsed = Recipe.fromJson(recipe.toJson());
      expect(() => parsed.ingredients.clear(), throwsUnsupportedError);
      expect(() => parsed.steps.clear(), throwsUnsupportedError);
    });

    test('blank() has a unique id, one empty ingredient and no steps', () {
      final now = DateTime.fromMillisecondsSinceEpoch(1234567);
      final a = withClock(Clock.fixed(now), Recipe.blank);
      final b = Recipe.blank();
      expect(a.id, isNot(b.id));
      expect(a.id, matches(RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
      expect(a.title, '');
      expect(a.ingredients, [Ingredient.empty]);
      expect(a.steps, isEmpty);
      expect(a.createdAt, 1234567);
      expect(a.updatedAt, 1234567);
    });
  });

  test('RecipeVersion JSON round-trip', () {
    final version = RecipeVersion(recipeId: 'r1', timestamp: 3000, snapshot: recipe);
    final json = version.toJson();
    expect(json.keys, ['recipeId', 'timestamp', 'snapshot']);
    expect(RecipeVersion.fromJson(json), version);
    expect(version.copyWith(timestamp: 3001).timestamp, 3001);
  });

  test('Draft JSON round-trip', () {
    final draft = Draft(recipeId: 'r1', recipe: recipe, savedAt: 4000);
    final json = draft.toJson();
    expect(json.keys, ['recipeId', 'recipe', 'savedAt']);
    expect(Draft.fromJson(json), draft);
    expect(draft.copyWith(savedAt: 4001).savedAt, 4001);
  });
}
