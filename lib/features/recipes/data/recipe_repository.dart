/// The only code that reads or writes [RecipeDatabase]. Going around it would
/// skip the version snapshot.
library;

import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart';

import 'recipe.dart';
import 'recipe_database.dart';

class RecipeRepository {
  RecipeRepository(this._db);

  final RecipeDatabase _db;

  Future<Recipe?> get(String id) async {
    final row = await (_db.select(_db.recipes)..where((r) => r.id.equals(id)))
        .getSingleOrNull();
    return row == null ? null : _toRecipe(row);
  }

  /// Most recently updated first.
  Future<List<Recipe>> list() async {
    final rows = await (_db.select(_db.recipes)
          ..orderBy([(r) => OrderingTerm.desc(r.updatedAtMs)]))
        .get();
    return [for (final row in rows) _toRecipe(row)];
  }

  /// Recipes whose title, an ingredient's name or note, or a step contains
  /// [query] (trimmed, case-insensitive for ASCII), most recently updated
  /// first. A blank query returns every recipe.
  Future<List<Recipe>> search(String query) async {
    final text = query.trim();
    if (text.isEmpty) return list();
    final escaped =
        text.replaceAllMapped(RegExp(r'[\\%_]'), (m) => '\\${m[0]}');
    final rows = await _db
        .customSelect(
          r'''
          SELECT * FROM recipes r
          WHERE r.title LIKE ?1 ESCAPE '\'
            OR EXISTS (SELECT 1 FROM json_each(r.ingredients_json) i
              WHERE json_extract(i.value, '$.name') LIKE ?1 ESCAPE '\'
                OR json_extract(i.value, '$.note') LIKE ?1 ESCAPE '\')
            OR EXISTS (SELECT 1 FROM json_each(r.steps_json) s
              WHERE s.value LIKE ?1 ESCAPE '\')
          ORDER BY r.updated_at_ms DESC''',
          variables: [Variable.withString('%$escaped%')],
          readsFrom: {_db.recipes},
        )
        .asyncMap(_db.recipes.mapFromRow)
        .get();
    return [for (final row in rows) _toRecipe(row)];
  }

  /// Writes [recipe], snapshotting whatever was there before. The snapshot is
  /// what makes every save undoable; a first save has no previous state to
  /// keep. Returns what was stored.
  Future<Recipe> save(Recipe recipe) => _db.transaction(() async {
        final previous = await get(recipe.id);
        final now = clock.now().millisecondsSinceEpoch;
        if (previous != null) {
          await _db.into(_db.versions).insert(VersionsCompanion.insert(
                recipeId: previous.id,
                timestampMs: await _nextVersionTimestamp(previous.id, now),
                snapshotJson: jsonEncode(previous.toJson()),
              ));
        }
        final next = recipe.copyWith(
          steps: [
            for (final step in recipe.steps)
              if (step.trim().isNotEmpty) step,
          ],
          createdAt: previous?.createdAt,
          updatedAt: previous != null && previous.updatedAt > now
              ? previous.updatedAt
              : now,
        );
        await _db.into(_db.recipes).insertOnConflictUpdate(RecipesCompanion.insert(
              id: next.id,
              title: next.title,
              ingredientsJson: jsonEncode(
                  [for (final i in next.ingredients) i.toJson()]),
              stepsJson: jsonEncode(next.steps),
              createdAtMs: next.createdAt,
              updatedAtMs: next.updatedAt,
            ));
        return next;
      });

  /// `(recipeId, timestamp)` is the version key, so two saves within the same
  /// millisecond must not collide. Step forward until the slot is free.
  Future<int> _nextVersionTimestamp(String recipeId, int now) async {
    var timestamp = now;
    while (await version(recipeId, timestamp) != null) {
      timestamp += 1;
    }
    return timestamp;
  }

  Future<void> delete(String id) => _db.transaction(() async {
        await (_db.delete(_db.recipes)..where((r) => r.id.equals(id))).go();
        await (_db.delete(_db.versions)..where((v) => v.recipeId.equals(id)))
            .go();
        await (_db.delete(_db.drafts)..where((d) => d.recipeId.equals(id)))
            .go();
      });

  /// Newest first.
  Future<List<RecipeVersion>> versions(String recipeId) async {
    final rows = await (_db.select(_db.versions)
          ..where((v) => v.recipeId.equals(recipeId))
          ..orderBy([(v) => OrderingTerm.desc(v.timestampMs)]))
        .get();
    return [for (final row in rows) _toVersion(row)];
  }

  Future<RecipeVersion?> version(String recipeId, int timestamp) async {
    final row = await (_db.select(_db.versions)
          ..where((v) =>
              v.recipeId.equals(recipeId) & v.timestampMs.equals(timestamp)))
        .getSingleOrNull();
    return row == null ? null : _toVersion(row);
  }

  /// Restores a snapshot. The revert is itself a save, so it too can be undone.
  Future<Recipe> revert(String recipeId, int timestamp) async {
    final found = await version(recipeId, timestamp);
    if (found == null) {
      throw StateError('No version $timestamp for recipe $recipeId');
    }
    return save(found.snapshot.copyWith(id: recipeId));
  }

  /// The distinct, trimmed, non-empty units across all recipes, sorted.
  Future<List<String>> knownUnits() async {
    final units = {
      for (final recipe in await list())
        for (final ingredient in recipe.ingredients)
          if (ingredient.unit.trim().isNotEmpty) ingredient.unit.trim(),
    };
    return units.toList()..sort();
  }

  Future<void> saveDraft(Recipe recipe) =>
      _db.into(_db.drafts).insertOnConflictUpdate(DraftsCompanion.insert(
            recipeId: recipe.id,
            recipeJson: jsonEncode(recipe.toJson()),
            savedAtMs: clock.now().millisecondsSinceEpoch,
          ));

  Future<Draft?> draft(String recipeId) async {
    final row = await (_db.select(_db.drafts)
          ..where((d) => d.recipeId.equals(recipeId)))
        .getSingleOrNull();
    if (row == null) return null;
    return Draft(
      recipeId: row.recipeId,
      recipe: Recipe.fromJson(jsonDecode(row.recipeJson) as Map<String, dynamic>),
      savedAt: row.savedAtMs,
    );
  }

  Future<void> clearDraft(String recipeId) =>
      (_db.delete(_db.drafts)..where((d) => d.recipeId.equals(recipeId))).go();

  static Recipe _toRecipe(RecipeRow row) => Recipe(
        id: row.id,
        title: row.title,
        ingredients: [
          for (final i in jsonDecode(row.ingredientsJson) as List)
            Ingredient.fromJson(i as Map<String, dynamic>),
        ],
        steps: (jsonDecode(row.stepsJson) as List).cast<String>(),
        createdAt: row.createdAtMs,
        updatedAt: row.updatedAtMs,
      );

  static RecipeVersion _toVersion(VersionRow row) => RecipeVersion(
        recipeId: row.recipeId,
        timestamp: row.timestampMs,
        snapshot:
            Recipe.fromJson(jsonDecode(row.snapshotJson) as Map<String, dynamic>),
      );
}
