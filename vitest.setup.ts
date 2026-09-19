import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom ships neither Blob#text nor the object-URL API the export path uses.
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:stub';
  URL.revokeObjectURL = () => {};
}
