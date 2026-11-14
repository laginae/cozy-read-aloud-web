'use strict';
const cases = [
  { name: 'negative exponent', formula: String.raw`10^{-9}`, expected: '10 to the power of negative 9' },
  { name: 'Chinese negative exponent', formula: String.raw`10^{-9}`, options: { mathReadingLanguage: 'chinese' }, expected: '10 的 负9 次方' },
  { name: 'underlined function', formula: String.raw`\underline f(x)`, expected: 'f underbar of x' },
  { name: 'decorated equality', formula: String.raw`\underline f(x)=\overline g(x)`, expected: 'f underbar of x equals g bar of x' },
  { name: 'compact argument', formula: String.raw`\widehat f(x_i)`, options: { academicFunctionStyle: 'compact' }, expected: 'f hat x i' },
  { name: 'explicit function unaffected', formula: String.raw`\overline f(x)`, options: { academicFunctionStyle: 'compact', academicMathStyle: 'verbose' }, expected: 'f bar open parenthesis x close parenthesis' },
  { name: 'tuple of functions', formula: '(f(x),g(x))', options: { academicFunctionStyle: 'compact' }, expected: 'f x, g x' },
  { name: 'closed interval', formula: String.raw`x\in[0,\overline b]`, expected: 'x belongs to the interval from 0 to b bar' },
  { name: 'range only', formula: String.raw`x\in(0,1]`, options: { academicIntervalStyle: 'range' }, expected: 'x belongs to 0 to 1' },
  { name: 'precise endpoints', formula: String.raw`x\in(0,1]`, expected: 'x belongs to the interval from 0 to 1, excluding 0, including 1' },
  { name: 'short percentage', formula: String.raw`\alpha=5\%`, expected: 'alpha equals 5 percent' },
  { name: 'Greek product', formula: String.raw`B\tau`, expected: 'B times tau' },
  { name: 'statistic expression', formula: String.raw`\operatorname{Var}(x)`, expected: 'variance of x' },
  { name: 'statistic preserves prefix', formula: 'a+Var(x)', expected: 'a plus variance of x' },
  { name: 'simple scripted arguments', formula: 'f_i(x_j)', expected: 'f i of x j' },
  { name: 'complex ratio still skipped', formula: String.raw`\bar{f_i}(x)/\hat{g_i}(x)`, expected: 'Formula.' },
  { name: 'malformed head', formula: String.raw`\hat(x)`, expected: 'Formula.' },
  { name: 'quiet omission', formula: String.raw`\sum_i x_i`, options: { academicSkipNotice: false }, expected: '' },
];
module.exports = { cases };
