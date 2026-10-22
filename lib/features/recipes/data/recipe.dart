/// The recipe domain model: immutable values with JSON matching the backup
/// format. All times are epoch milliseconds.
library;

import 'package:clock/clock.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

@immutable
class Ingredient {
  const Ingredient({
    required this.amount,
    required this.unit,
    required this.name,
    required this.note,
  });

  static const empty = Ingredient(amount: null, unit: '', name: '', note: '');

  /// `null` means "no amount" (salt, to taste), never zero.
  final double? amount;
  final String unit;
  final String name;
  final String note;

  /// [amount] is a function so it can be cleared: `copyWith(amount: () => null)`.
  Ingredient copyWith({
    double? Function()? amount,
    String? unit,
    String? name,
    String? note,
  }) =>
      Ingredient(
        amount: amount != null ? amount() : this.amount,
        unit: unit ?? this.unit,
        name: name ?? this.name,
        note: note ?? this.note,
      );

  Map<String, dynamic> toJson() =>
      {'amount': amount, 'unit': unit, 'name': name, 'note': note};

  factory Ingredient.fromJson(Map<String, dynamic> json) => Ingredient(
        amount: (json['amount'] as num?)?.toDouble(),
        unit: json['unit'] as String,
        name: json['name'] as String,
        note: json['note'] as String,
      );

  @override
  bool operator ==(Object other) =>
      other is Ingredient &&
      other.amount == amount &&
      other.unit == unit &&
      other.name == name &&
      other.note == note;

  @override
  int get hashCode => Object.hash(amount, unit, name, note);

  @override
  String toString() => 'Ingredient($amount, $unit, $name, $note)';
}

@immutable
class Recipe {
  Recipe({
    required this.id,
    required this.title,
    required List<Ingredient> ingredients,
    required List<String> steps,
    required this.createdAt,
    required this.updatedAt,
  })  : ingredients = List.unmodifiable(ingredients),
        steps = List.unmodifiable(steps);

  /// A new recipe: fresh uuid, empty title, one empty ingredient, no steps.
  factory Recipe.blank() {
    final now = clock.now().millisecondsSinceEpoch;
    return Recipe(
      id: _uuid.v4(),
      title: '',
      ingredients: const [Ingredient.empty],
      steps: const [],
      createdAt: now,
      updatedAt: now,
    );
  }

  final String id;
  final String title;
  final List<Ingredient> ingredients;
  final List<String> steps;
  final int createdAt;
  final int updatedAt;

  Recipe copyWith({
    String? id,
    String? title,
    List<Ingredient>? ingredients,
    List<String>? steps,
    int? createdAt,
    int? updatedAt,
  }) =>
      Recipe(
        id: id ?? this.id,
        title: title ?? this.title,
        ingredients: ingredients ?? this.ingredients,
        steps: steps ?? this.steps,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'ingredients': [for (final i in ingredients) i.toJson()],
        'steps': steps,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  factory Recipe.fromJson(Map<String, dynamic> json) => Recipe(
        id: json['id'] as String,
        title: json['title'] as String,
        ingredients: [
          for (final i in json['ingredients'] as List)
            Ingredient.fromJson(i as Map<String, dynamic>),
        ],
        steps: (json['steps'] as List).cast<String>(),
        createdAt: json['createdAt'] as int,
        updatedAt: json['updatedAt'] as int,
      );

  @override
  bool operator ==(Object other) =>
      other is Recipe &&
      other.id == id &&
      other.title == title &&
      listEquals(other.ingredients, ingredients) &&
      listEquals(other.steps, steps) &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt;

  @override
  int get hashCode => Object.hash(id, title, Object.hashAll(ingredients),
      Object.hashAll(steps), createdAt, updatedAt);

  @override
  String toString() => 'Recipe($id, $title)';
}

/// A full snapshot of a recipe as it was before a save, keyed
/// `(recipeId, timestamp)`.
@immutable
class RecipeVersion {
  const RecipeVersion({
    required this.recipeId,
    required this.timestamp,
    required this.snapshot,
  });

  final String recipeId;
  final int timestamp;
  final Recipe snapshot;

  RecipeVersion copyWith({String? recipeId, int? timestamp, Recipe? snapshot}) =>
      RecipeVersion(
        recipeId: recipeId ?? this.recipeId,
        timestamp: timestamp ?? this.timestamp,
        snapshot: snapshot ?? this.snapshot,
      );

  Map<String, dynamic> toJson() => {
        'recipeId': recipeId,
        'timestamp': timestamp,
        'snapshot': snapshot.toJson(),
      };

  factory RecipeVersion.fromJson(Map<String, dynamic> json) => RecipeVersion(
        recipeId: json['recipeId'] as String,
        timestamp: json['timestamp'] as int,
        snapshot: Recipe.fromJson(json['snapshot'] as Map<String, dynamic>),
      );

  @override
  bool operator ==(Object other) =>
      other is RecipeVersion &&
      other.recipeId == recipeId &&
      other.timestamp == timestamp &&
      other.snapshot == snapshot;

  @override
  int get hashCode => Object.hash(recipeId, timestamp, snapshot);

  @override
  String toString() => 'RecipeVersion($recipeId, $timestamp)';
}

/// An in-progress edit, autosaved so a backgrounded tab loses nothing.
@immutable
class Draft {
  const Draft({
    required this.recipeId,
    required this.recipe,
    required this.savedAt,
  });

  final String recipeId;
  final Recipe recipe;
  final int savedAt;

  Draft copyWith({String? recipeId, Recipe? recipe, int? savedAt}) => Draft(
        recipeId: recipeId ?? this.recipeId,
        recipe: recipe ?? this.recipe,
        savedAt: savedAt ?? this.savedAt,
      );

  Map<String, dynamic> toJson() =>
      {'recipeId': recipeId, 'recipe': recipe.toJson(), 'savedAt': savedAt};

  factory Draft.fromJson(Map<String, dynamic> json) => Draft(
        recipeId: json['recipeId'] as String,
        recipe: Recipe.fromJson(json['recipe'] as Map<String, dynamic>),
        savedAt: json['savedAt'] as int,
      );

  @override
  bool operator ==(Object other) =>
      other is Draft &&
      other.recipeId == recipeId &&
      other.recipe == recipe &&
      other.savedAt == savedAt;

  @override
  int get hashCode => Object.hash(recipeId, recipe, savedAt);

  @override
  String toString() => 'Draft($recipeId, $savedAt)';
}
