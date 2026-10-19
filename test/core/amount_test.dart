import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_manager/core/amount.dart';

void main() {
  group('parseAmount', () {
    test('parses plain integers and decimals', () {
      expect(parseAmount('2'), 2);
      expect(parseAmount('0.5'), 0.5);
      expect(parseAmount('1.25'), 1.25);
    });

    test('parses simple fractions', () {
      expect(parseAmount('1/2'), 0.5);
      expect(parseAmount('3/4'), 0.75);
      expect(parseAmount('2/3'), closeTo(0.6666667, 1e-6));
    });

    test('parses mixed numbers', () {
      expect(parseAmount('1 1/2'), 1.5);
      expect(parseAmount('2 3/4'), 2.75);
    });

    test('parses unicode vulgar fractions, alone and mixed', () {
      expect(parseAmount('½'), 0.5);
      expect(parseAmount('1½'), 1.5);
      expect(parseAmount('1 ¾'), 1.75);
      expect(parseAmount('⅓'), closeTo(0.3333333, 1e-6));
    });

    test('tolerates surrounding and internal whitespace', () {
      expect(parseAmount('  1 1/2  '), 1.5);
      expect(parseAmount('1  /  2'), 0.5);
    });

    test('returns null for empty or non-numeric input', () {
      expect(parseAmount(''), isNull);
      expect(parseAmount('   '), isNull);
      expect(parseAmount('to taste'), isNull);
      expect(parseAmount('a pinch'), isNull);
    });

    test('returns null rather than Infinity for a zero denominator', () {
      expect(parseAmount('1/0'), isNull);
    });

    test('ignores a negative sign, since recipes have no negative amounts', () {
      expect(parseAmount('-2'), isNull);
    });

    // The TS version also took a number; Dart callers already holding a
    // double don't need parsing, so only the null case carries over.
    test('passes numbers through unchanged', () {
      expect(parseAmount(null), isNull);
    });

    test('returns null for more than two terms', () {
      expect(parseAmount('1 1 1/2'), isNull);
    });

    test('returns null for a whole number following a fraction', () {
      expect(parseAmount('1/2 1'), isNull);
    });
  });

  group('formatAmount', () {
    test('formats null as an empty string', () {
      expect(formatAmount(null), '');
    });

    test('formats non-finite values as an empty string', () {
      expect(formatAmount(double.infinity), '');
      expect(formatAmount(double.nan), '');
    });

    test('formats whole numbers without decimals', () {
      expect(formatAmount(2), '2');
      expect(formatAmount(1e15), '1000000000000000');
      expect(formatAmount(-0.0), '0');
    });

    test('formats common fractions back to fraction notation', () {
      expect(formatAmount(0.5), '1/2');
      expect(formatAmount(0.75), '3/4');
      expect(formatAmount(1.5), '1 1/2');
      expect(formatAmount(2.25), '2 1/4');
    });

    test('falls back to a trimmed decimal for uncommon values', () {
      expect(formatAmount(1.37), '1.37');
      expect(formatAmount(0.1), '0.1');
    });

    test('round-trips through parseAmount', () {
      for (final raw in ['1/2', '1 1/2', '2', '3/4', '2 2/3']) {
        expect(
          parseAmount(formatAmount(parseAmount(raw))),
          closeTo(parseAmount(raw)!, 1e-6),
        );
      }
    });
  });
}
