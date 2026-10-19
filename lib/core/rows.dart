/// List helpers for the editor's ingredient and step rows. Every function
/// returns a new list and never mutates its input.
library;

List<T> addRow<T>(List<T> rows, T Function() makeEmpty, {int? afterIndex}) {
  final at = (afterIndex == null ? rows.length : afterIndex + 1).clamp(
    0,
    rows.length,
  );
  return [...rows]..insert(at, makeEmpty());
}

/// Removing the last row leaves a blank one, so the form always has a place
/// to type.
List<T> removeRow<T>(List<T> rows, int index, T Function() makeEmpty) {
  if (index < 0 || index >= rows.length) return rows;
  final next = [...rows]..removeAt(index);
  return next.isEmpty ? [makeEmpty()] : next;
}

List<T> moveRow<T>(List<T> rows, int from, int to) {
  if (from < 0 ||
      from >= rows.length ||
      to < 0 ||
      to >= rows.length ||
      from == to) {
    return rows;
  }
  final next = [...rows];
  next.insert(to, next.removeAt(from));
  return next;
}

List<T> updateRow<T>(List<T> rows, int index, T Function(T) update) {
  if (index < 0 || index >= rows.length) return rows;
  return [
    for (var i = 0; i < rows.length; i++)
      i == index ? update(rows[i]) : rows[i],
  ];
}
