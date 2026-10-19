/// Amount parsing/formatting. Recipe amounts are stored as nullable numbers
/// ("salt, to taste" has no amount) but are written and read as fractions.
library;

const _vulgar = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', //
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
  '⅚': '5/6', '⅐': '1/7', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8',
  '⅞': '7/8', '⅑': '1/9', '⅒': '1/10', '↉': '0/3',
};

final _vulgarRe = RegExp('[${_vulgar.keys.join()}]');
final _slashRe = RegExp(r'\s*/\s*');
final _spaceRe = RegExp(r'\s+');
final _fractionRe = RegExp(r'^(\d+)/(\d+)$');
final _decimalRe = RegExp(r'^\d+(\.\d+)?$');

/// Denominators worth showing as fractions; anything else stays decimal.
const _denominators = [2, 3, 4, 6, 8, 16];
const _epsilon = 1e-6;

double? parseAmount(String? raw) {
  if (raw == null) return null;

  final normalized = raw
      .replaceAllMapped(_vulgarRe, (m) => ' ${_vulgar[m[0]]} ')
      .replaceAll(_slashRe, '/')
      .trim()
      .replaceAll(_spaceRe, ' ');

  if (normalized.isEmpty) return null;

  final parts = normalized.split(' ');
  if (parts.length > 2) return null;

  var total = 0.0;
  for (var i = 0; i < parts.length; i++) {
    final value = _parseTerm(parts[i]);
    if (value == null) return null;
    // A fraction may only follow a whole number, never the other way round.
    if (i == 1 && !parts[1].contains('/')) return null;
    total += value;
  }
  return total;
}

double? _parseTerm(String term) {
  final fraction = _fractionRe.firstMatch(term);
  if (fraction != null) {
    final denominator = double.parse(fraction[2]!);
    if (denominator == 0) return null;
    return double.parse(fraction[1]!) / denominator;
  }
  if (_decimalRe.hasMatch(term)) return double.parse(term);
  return null;
}

String formatAmount(double? value) {
  if (value == null || !value.isFinite) return '';
  if (value == value.truncateToDouble()) return _formatWhole(value);

  final whole = value.floor();
  final remainder = value - whole;

  for (final denominator in _denominators) {
    final numerator = remainder * denominator;
    final rounded = numerator.round();
    if (rounded > 0 &&
        rounded < denominator &&
        (numerator - rounded).abs() < _epsilon) {
      final fraction = '$rounded/$denominator';
      return whole > 0 ? '$whole $fraction' : fraction;
    }
  }

  final trimmed = double.parse(value.toStringAsFixed(4));
  if (trimmed == trimmed.truncateToDouble()) return _formatWhole(trimmed);
  return trimmed.toString();
}

/// `2.0` → `2`; huge values keep Dart's exponent form rather than overflow.
String _formatWhole(double value) =>
    value.abs() < 1e15 ? value.toInt().toString() : value.toString();
