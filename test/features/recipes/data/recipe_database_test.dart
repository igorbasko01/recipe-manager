import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/features/recipes/data/recipe_database.dart';

void main() {
  late RecipeDatabase db;

  setUp(() => db = RecipeDatabase.forTesting(NativeDatabase.memory()));
  tearDown(() => db.close());

  test('all four tables exist', () async {
    final rows = await db
        .customSelect("SELECT name FROM sqlite_master WHERE type = 'table'")
        .get();
    final names = rows.map((r) => r.read<String>('name')).toSet();
    expect(names, containsAll(['recipes', 'versions', 'drafts', 'recipes_fts']));
  });

  test('recipes_fts supports MATCH (FTS5 is available)', () async {
    await db.customStatement(
      'INSERT INTO recipes_fts (recipe_id, title, ingredients, steps) '
      'VALUES (?, ?, ?, ?)',
      ['r1', 'Crème brûlée', 'cream sugar', 'Bake slowly'],
    );
    final rows = await db.customSelect(
      'SELECT recipe_id FROM recipes_fts WHERE recipes_fts MATCH ?',
      variables: [Variable.withString('"creme"* "brul"*')],
    ).get();
    expect(rows.map((r) => r.read<String>('recipe_id')), ['r1']);
  });

  test('versions use (recipe_id, timestamp_ms) as the primary key', () async {
    Future<void> insert() => db.into(db.versions).insert(
        VersionsCompanion.insert(recipeId: 'r1', timestampMs: 1, snapshotJson: '{}'));
    await insert();
    await db.into(db.versions).insert(
        VersionsCompanion.insert(recipeId: 'r1', timestampMs: 2, snapshotJson: '{}'));
    await expectLater(insert(), throwsA(isA<SqliteException>()));
  });

  test('updated_at_ms is indexed', () async {
    final rows = await db
        .customSelect("SELECT sql FROM sqlite_master WHERE type = 'index' "
            "AND tbl_name = 'recipes'")
        .get();
    expect(rows.map((r) => r.read<String?>('sql') ?? ''),
        contains(contains('updated_at_ms')));
  });
}
