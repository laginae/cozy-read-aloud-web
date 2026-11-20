'use strict';

// Return fresh public examples; each reader applies its own normal formatting pipeline.
function academicPreviewSamples(language = 'english') {
  const zh = /^(?:chinese|zh(?:[-_].*)?)$/i.test(language);
  return [
    ['f(x)', zh ? '函数 $f(x)$。' : 'The function $f(x)$.'],
    ['[0, 1)', zh ? '区间为 $[0,1)$。' : 'The interval is $[0,1)$.'],
    [zh ? '颜色 / 数量：蓝 2，绿 3' : 'Color / Count: Blue 2, Green 3', zh
      ? '|颜色|数量|\n|---|---|\n|蓝|2|\n|绿|3|' : '|Color|Count|\n|---|---|\n|Blue|2|\n|Green|3|'],
  ];
}

module.exports = { academicPreviewSamples };
