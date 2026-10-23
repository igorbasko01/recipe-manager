import 'package:clock/clock.dart';
import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/features/recipes/data/recipe.dart';
import 'package:recipe_manager/features/recipes/data/recipe_database.dart';
import 'package:recipe_manager/features/recipes/data/recipe_repository.dart';

Recipe sample({
  String title = 'Pancakes',
  List<Ingredient> ingredients = const [
    Ingredient(amount: 1.5, unit: 'cup', name: 'flour', note: 'sifted'),
  ],
  List<String> steps = const ['Mix.', 'Fry.'],
}) =>
    Recipe.blank()
        .copyWith(title: title, ingredients: ingredients, steps: steps);

DateTime at(int ms) => DateTime.fromMillisecondsSinceEpoch(ms);

void main() {
  late RecipeDatabase db;
  late RecipeRepository repo;

  setUp(() {
    db = RecipeDatabase.forTesting(NativeDatabase.memory());
    repo = RecipeRepository(db);
  });
  tearDown(() => db.close());

  Future<List<Map<String, Object?>>> ftsRows(String id) async {
    final rows = await db.customSelect(
      'SELECT title, ingredients, steps FROM recipes_fts WHERE recipe_id = ?',
      variables: [Variable.withString(id)],
    ).get();
    return [for (final r in rows) r.data];
  }

  group('save', () {
    test('persists a new recipe and returns it', () async {
      final saved = await repo.save(sample());
      expect((await repo.get(saved.id))!.title, 'Pancakes');
      expect(await repo.get(saved.id), saved);
    });

    test('writes no version for a first save, since there is no previous state',
        () async {
      final saved = await repo.save(sample());
      expect(await repo.versions(saved.id), isEmpty);
    });

    test('snapshots the previous state on every subsequent save', () async {
      final first = await repo.save(sample(title: 'v1'));
      await repo.save(first.copyWith(title: 'v2'));
      await repo.save(first.copyWith(title: 'v3'));

      final versions = await repo.versions(first.id);
      expect(versions.map((v) => v.snapshot.title), ['v2', 'v1']);
    });

    test('lists versions newest first', () async {
      final first = await repo.save(sample(title: 'a'));
      await repo.save(first.copyWith(title: 'b'));
      await repo.save(first.copyWith(title: 'c'));

      final versions = await repo.versions(first.id);
      expect(versions[0].timestamp,
          greaterThanOrEqualTo(versions[1].timestamp));
    });

    test('gives each version a distinct timestamp, even in the same millisecond',
        () async {
      await withClock(Clock.fixed(at(5000)), () async {
        final first = await repo.save(sample(title: 'a'));
        for (final title in ['b', 'c', 'd', 'e']) {
          await repo.save(first.copyWith(title: title));
        }
        final versions = await repo.versions(first.id);
        expect(versions, hasLength(4));
        expect(versions.map((v) => v.timestamp).toSet(), hasLength(4));
      });
    });

    test('advances updatedAt but keeps createdAt', () async {
      final first =
          await withClock(Clock.fixed(at(1000)), () => repo.save(sample()));
      final second = await withClock(Clock.fixed(at(2000)),
          () => repo.save(first.copyWith(title: 'changed', createdAt: 99)));
      expect(second.createdAt, first.createdAt);
      expect(second.updatedAt, 2000);
    });

    test('never moves updatedAt backwards when the clock does', () async {
      final first =
          await withClock(Clock.fixed(at(5000)), () => repo.save(sample()));
      final second = await withClock(Clock.fixed(at(1000)),
          () => repo.save(first.copyWith(title: 'changed')));
      expect(second.updatedAt, 5000);
    });

    test('stored values are unaffected by later copyWith on the input',
        () async {
      final recipe = sample();
      final saved = await repo.save(recipe);
      recipe.copyWith(ingredients: const [
        Ingredient(amount: 1, unit: '', name: 'mutated', note: ''),
      ]);
      expect((await repo.get(saved.id))!.ingredients[0].name, 'flour');
      expect(() => saved.ingredients.add(Ingredient.empty),
          throwsUnsupportedError);
      expect(() => saved.steps.add('x'), throwsUnsupportedError);
    });

    test('drops blank steps', () async {
      final saved = await repo.save(sample(steps: ['Mix.', '  ', '', 'Fry.']));
      expect(saved.steps, ['Mix.', 'Fry.']);
      expect((await repo.get(saved.id))!.steps, ['Mix.', 'Fry.']);
    });

    test('indexes exactly one recipes_fts row with the joined text', () async {
      final first = await repo.save(sample(
        title: 'Bread',
        ingredients: const [
          Ingredient(amount: 2, unit: 'cup', name: 'flour', note: 'sifted'),
          Ingredient(amount: null, unit: '', name: 'salt', note: ''),
        ],
        steps: ['Knead.', 'Bake.'],
      ));
      await repo.save(first.copyWith(title: 'Rye bread'));

      expect(await ftsRows(first.id), [
        {
          'title': 'Rye bread',
          'ingredients': 'flour sifted salt',
          'steps': 'Knead. Bake.',
        }
      ]);
    });
  });

  group('steps', () {
    test('round-trip through save and reload in order', () async {
      final saved =
          await repo.save(sample(steps: ['Whisk.', 'Rest.', 'Fry.']));
      expect((await repo.get(saved.id))!.steps, ['Whisk.', 'Rest.', 'Fry.']);
    });

    test('keep a reordering across a save, with the old order in history',
        () async {
      final saved = await repo.save(sample(steps: ['Whisk.', 'Rest.']));
      await repo.save(saved.copyWith(steps: ['Rest.', 'Whisk.']));

      expect((await repo.get(saved.id))!.steps, ['Rest.', 'Whisk.']);
      expect((await repo.versions(saved.id))[0].snapshot.steps,
          ['Whisk.', 'Rest.']);
    });
  });

  group('list', () {
    test('returns recipes most recently updated first', () async {
      final a = await withClock(
          Clock.fixed(at(1000)), () => repo.save(sample(title: 'A')));
      await withClock(
          Clock.fixed(at(2000)), () => repo.save(sample(title: 'B')));
      await withClock(Clock.fixed(at(3000)),
          () => repo.save(a.copyWith(title: 'A again')));

      expect((await repo.list()).map((r) => r.title), ['A again', 'B']);
    });
  });

  group('delete', () {
    test('removes the recipe along with its versions, draft and search row',
        () async {
      final saved = await repo.save(sample());
      await repo.save(saved.copyWith(title: 'second'));
      await repo.saveDraft(saved.copyWith(title: 'draft'));

      await repo.delete(saved.id);

      expect(await repo.get(saved.id), isNull);
      expect(await repo.versions(saved.id), isEmpty);
      expect(await repo.draft(saved.id), isNull);
      expect(await ftsRows(saved.id), isEmpty);
    });

    test('leaves other recipes alone', () async {
      final keep = await repo.save(sample(title: 'keep'));
      final gone = await repo.save(sample(title: 'gone'));
      await repo.delete(gone.id);
      expect((await repo.list()).map((r) => r.id), [keep.id]);
      expect(await ftsRows(keep.id), hasLength(1));
    });
  });

  group('revert', () {
    test('restores an older snapshot as the current recipe', () async {
      final first = await repo.save(sample(title: 'original'));
      await repo.save(first.copyWith(title: 'edited'));

      final [version] = await repo.versions(first.id);
      final reverted = await repo.revert(first.id, version.timestamp);

      expect(reverted.title, 'original');
      expect((await repo.get(first.id))!.title, 'original');
    });

    test('records the pre-revert state as a version, so a revert is undoable',
        () async {
      final first = await repo.save(sample(title: 'original'));
      await repo.save(first.copyWith(title: 'edited'));
      final [version] = await repo.versions(first.id);

      await repo.revert(first.id, version.timestamp);

      final titles =
          (await repo.versions(first.id)).map((v) => v.snapshot.title);
      expect(titles, contains('edited'));
    });

    test('keeps the recipe id stable across a revert', () async {
      final first = await repo.save(sample());
      await repo.save(first.copyWith(title: 'edited'));
      final [version] = await repo.versions(first.id);
      expect((await repo.revert(first.id, version.timestamp)).id, first.id);
    });

    test('rejects an unknown version', () async {
      final saved = await repo.save(sample());
      await expectLater(
        repo.revert(saved.id, 123),
        throwsA(isA<StateError>()
            .having((e) => e.message, 'message', contains('version'))),
      );
    });
  });

  group('version', () {
    test('reads back a single snapshot by its key', () async {
      final first = await repo.save(sample(title: 'original'));
      await repo.save(first.copyWith(title: 'edited'));
      final [version] = await repo.versions(first.id);
      expect((await repo.version(first.id, version.timestamp))!.snapshot.title,
          'original');
      expect(await repo.version(first.id, version.timestamp + 1), isNull);
    });
  });

  group('knownUnits', () {
    test('collects the distinct units already used, sorted', () async {
      await repo.save(sample(ingredients: const [
        Ingredient(amount: 1, unit: 'tbsp', name: 'oil', note: ''),
        Ingredient(amount: 2, unit: ' cup ', name: 'flour', note: ''),
      ]));
      await repo.save(sample(ingredients: const [
        Ingredient(amount: 1, unit: 'cup', name: 'milk', note: ''),
        Ingredient(amount: null, unit: '', name: 'salt', note: 'to taste'),
      ]));

      expect(await repo.knownUnits(), ['cup', 'tbsp']);
    });
  });

  group('drafts', () {
    test('round-trips a draft and clears it', () async {
      final recipe = sample(title: 'half typed');
      await withClock(Clock.fixed(at(4242)), () => repo.saveDraft(recipe));
      final draft = (await repo.draft(recipe.id))!;
      expect(draft.recipe, recipe);
      expect(draft.recipeId, recipe.id);
      expect(draft.savedAt, 4242);

      await repo.clearDraft(recipe.id);
      expect(await repo.draft(recipe.id), isNull);
    });

    test('overwrites the previous draft for the same recipe', () async {
      final recipe = sample();
      await repo.saveDraft(recipe.copyWith(title: 'one'));
      await repo.saveDraft(recipe.copyWith(title: 'two'));
      expect(await db.select(db.drafts).get(), hasLength(1));
      expect((await repo.draft(recipe.id))!.recipe.title, 'two');
    });

    test('keeps blank steps in a draft, since editing is still in progress',
        () async {
      final recipe = sample(steps: ['Mix.', '']);
      await repo.saveDraft(recipe);
      expect((await repo.draft(recipe.id))!.recipe.steps, ['Mix.', '']);
    });
  });
}
