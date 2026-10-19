import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/core/rows.dart';

typedef Row = ({double? amount, String unit, String name, String note});

Row emptyRow() => (amount: null, unit: '', name: '', note: '');

void main() {
  final List<Row> rows = [
    (amount: 1, unit: 'cup', name: 'flour', note: ''),
    (amount: 2, unit: '', name: 'eggs', note: ''),
    (amount: null, unit: '', name: 'salt', note: 'to taste'),
  ];

  List<String> names(List<Row> rows) => [for (final r in rows) r.name];

  group('addRow', () {
    test('appends a blank row', () {
      final next = addRow(rows, emptyRow);
      expect(next, hasLength(4));
      expect(next[3], (amount: null, unit: '', name: '', note: ''));
    });

    test('inserts after a given index', () {
      expect(names(addRow(rows, emptyRow, afterIndex: 0)), [
        'flour',
        '',
        'eggs',
        'salt',
      ]);
    });

    test('does not mutate the input', () {
      addRow(rows, emptyRow);
      expect(rows, hasLength(3));
    });
  });

  group('removeRow', () {
    test('removes the row at an index', () {
      expect(names(removeRow(rows, 1, emptyRow)), ['flour', 'salt']);
    });

    test('keeps one blank row rather than emptying the list entirely', () {
      final List<Row> single = [(amount: 1, unit: '', name: 'only', note: '')];
      final next = removeRow(single, 0, emptyRow);
      expect(next, hasLength(1));
      expect(next[0].name, '');
    });

    test('ignores an out-of-range index', () {
      expect(removeRow(rows, 9, emptyRow), rows);
      expect(removeRow(rows, -1, emptyRow), rows);
    });

    test('does not mutate the input', () {
      removeRow(rows, 0, emptyRow);
      expect(names(rows), ['flour', 'eggs', 'salt']);
    });
  });

  group('moveRow', () {
    test('moves a row down', () {
      expect(names(moveRow(rows, 0, 1)), ['eggs', 'flour', 'salt']);
    });

    test('moves a row up', () {
      expect(names(moveRow(rows, 2, 0)), ['salt', 'flour', 'eggs']);
    });

    test('is a no-op when the target is out of range', () {
      expect(moveRow(rows, 0, -1), rows);
      expect(moveRow(rows, 2, 3), rows);
      expect(moveRow(rows, 3, 0), rows);
    });

    test('is a no-op when from equals to', () {
      expect(moveRow(rows, 1, 1), rows);
    });

    test('does not mutate the input', () {
      moveRow(rows, 0, 2);
      expect(names(rows), ['flour', 'eggs', 'salt']);
    });
  });

  group('updateRow', () {
    test('patches a single field of one row', () {
      final next = updateRow(
        rows,
        1,
        (r) =>
            (amount: r.amount, unit: r.unit, name: 'egg yolks', note: r.note),
      );
      expect(next[1], (amount: 2.0, unit: '', name: 'egg yolks', note: ''));
      expect(next[0], rows[0]);
    });

    test('ignores an out-of-range index', () {
      expect(
        updateRow(
          rows,
          9,
          (r) => (amount: r.amount, unit: r.unit, name: 'nope', note: r.note),
        ),
        rows,
      );
    });

    test('does not mutate the input', () {
      updateRow(
        rows,
        0,
        (r) => (amount: r.amount, unit: r.unit, name: 'rye', note: r.note),
      );
      expect(names(rows), ['flour', 'eggs', 'salt']);
    });
  });

  group('helpers on rows that are not ingredients', () {
    String emptyStep() => '';
    const steps = ['whisk', 'rest', 'fry'];

    test('adds, removes, moves and updates generic rows', () {
      expect(addRow(steps, emptyStep, afterIndex: 0), [
        'whisk',
        '',
        'rest',
        'fry',
      ]);
      expect(removeRow(steps, 1, emptyStep), ['whisk', 'fry']);
      expect(moveRow(steps, 2, 0), ['fry', 'whisk', 'rest']);
      expect(updateRow(steps, 1, (_) => 'rest 10 min')[1], 'rest 10 min');
    });

    test('leaves a blank row of the right shape when the last is removed', () {
      expect(removeRow(['only'], 0, emptyStep), ['']);
    });
  });
}
