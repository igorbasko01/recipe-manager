/// The drift schema. Only `RecipeRepository` reads or writes it.
library;

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter/foundation.dart';

part 'recipe_database.g.dart';

@DataClassName('RecipeRow')
@TableIndex(name: 'recipes_updated_at_ms', columns: {#updatedAtMs})
class Recipes extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get ingredientsJson => text()();
  TextColumn get stepsJson => text()();
  IntColumn get createdAtMs => integer()();
  IntColumn get updatedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('VersionRow')
class Versions extends Table {
  TextColumn get recipeId => text()();
  IntColumn get timestampMs => integer()();
  TextColumn get snapshotJson => text()();

  @override
  Set<Column> get primaryKey => {recipeId, timestampMs};
}

@DataClassName('DraftRow')
class Drafts extends Table {
  TextColumn get recipeId => text()();
  TextColumn get recipeJson => text()();
  IntColumn get savedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {recipeId};
}

@DriftDatabase(tables: [Recipes, Versions, Drafts])
class RecipeDatabase extends _$RecipeDatabase {
  RecipeDatabase()
      : super(driftDatabase(
          name: 'recipes',
          web: DriftWebOptions(
            sqlite3Wasm: Uri.parse('sqlite3.wasm'),
            driftWorker: Uri.parse('drift_worker.js'),
            onResult: (result) => debugPrint(
                'recipes db: ${result.chosenImplementation} '
                '(missing: ${result.missingFeatures})'),
          ),
        ));

  RecipeDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;
}
