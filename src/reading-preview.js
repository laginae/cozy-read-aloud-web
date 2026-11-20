import examples from '@laginae/note-reader-core/academic-preview';

export function previewRows(settings, language, format) {
  return examples.academicPreviewSamples(language).map(([label,sample]) => [label, format(sample,settings) || (language === 'en' ? '(omitted)' : '（略过）')]);
}

export function bindReadingPreview(box, getSettings, getLanguage, format) {
  const list = box.ownerDocument.createElement('dl'); box.append(list);
  const refresh = () => {
    if (!box.open) return;
    const doc = box.ownerDocument, fragment = doc.createDocumentFragment();
    for (const [label,text] of previewRows(getSettings(),getLanguage(),format)) {
      const title=doc.createElement('dt'), result=doc.createElement('dd');
      title.textContent=label; result.textContent=text; fragment.append(title,result);
    }
    list.replaceChildren(fragment);
  };
  box.addEventListener('toggle',refresh);
  return refresh;
}
