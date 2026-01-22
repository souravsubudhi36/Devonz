import { useState, useCallback } from 'react';
import type { ElementInfo } from './Inspector';

interface InspectorPanelProps {
  selectedElement: ElementInfo | null;
  isVisible: boolean;
  onClose: () => void;
  onStyleChange?: (property: string, value: string) => void;
  onTextChange?: (text: string) => void;
  onApplyWithAI?: (changes: { element: ElementInfo; styles: Record<string, string>; text?: string }) => void;
  onDeleteElement?: (element: ElementInfo) => void;
}

export const InspectorPanel = ({
  selectedElement,
  isVisible,
  onClose,
  onStyleChange,
  onTextChange,
  onApplyWithAI,
  onDeleteElement,
}: InspectorPanelProps) => {
  const [activeTab, setActiveTab] = useState<'styles' | 'text' | 'box'>('styles');
  const [editedStyles, setEditedStyles] = useState<Record<string, string>>({});
  const [editedText, setEditedText] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Reset edited values when element changes
  const handleStyleChange = useCallback(
    (property: string, value: string) => {
      console.log('[InspectorPanel] Style change:', property, value);
      setEditedStyles((prev) => ({ ...prev, [property]: value }));
      onStyleChange?.(property, value);
    },
    [onStyleChange],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      console.log('[InspectorPanel] Text change:', text);
      setEditedText(text);
      onTextChange?.(text);
    },
    [onTextChange],
  );

  // Check if there are any changes to apply
  const hasChanges = Object.keys(editedStyles).length > 0 || editedText.length > 0;

  // Generate CSS string from edited styles
  const generateCSS = useCallback(() => {
    if (Object.keys(editedStyles).length === 0) {
      return '';
    }

    const selector = selectedElement?.selector || selectedElement?.tagName.toLowerCase() || 'element';
    const styleLines = Object.entries(editedStyles)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n');

    return `${selector} {\n${styleLines}\n}`;
  }, [editedStyles, selectedElement]);

  // Copy CSS to clipboard
  const handleCopyCSS = useCallback(async () => {
    const css = generateCSS();

    if (!css) {
      setCopyFeedback('No changes to copy');
      setTimeout(() => setCopyFeedback(null), 2000);

      return;
    }

    try {
      await navigator.clipboard.writeText(css);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [generateCSS]);

  // Apply with AI
  const handleApplyWithAI = useCallback(() => {
    if (!selectedElement || !hasChanges) {
      return;
    }

    onApplyWithAI?.({
      element: selectedElement,
      styles: editedStyles,
      text: editedText || undefined,
    });
  }, [selectedElement, editedStyles, editedText, hasChanges, onApplyWithAI]);

  if (!isVisible || !selectedElement) {
    return null;
  }

  const getRelevantStyles = (styles: Record<string, string>) => {
    const relevantProps = [
      'color',
      'background-color',
      'background',
      'font-size',
      'font-weight',
      'font-family',
      'text-align',
      'padding',
      'margin',
      'border',
      'border-radius',
      'width',
      'height',
      'display',
      'position',
      'flex-direction',
      'justify-content',
      'align-items',
      'gap',
    ];

    return relevantProps.reduce(
      (acc, prop) => {
        const value = styles[prop];

        if (value) {
          acc[prop] = value;
        }

        return acc;
      },
      {} as Record<string, string>,
    );
  };

  const isColorProperty = (prop: string) => {
    return prop.includes('color') || prop === 'background' || prop.includes('border');
  };

  const parseColorFromValue = (value: string): string | null => {
    // Try to extract hex color
    const hexMatch = value.match(/#([0-9a-fA-F]{3,8})/);

    if (hexMatch) {
      return hexMatch[0];
    }

    // Try to extract rgb/rgba
    const rgbMatch = value.match(/rgba?\([^)]+\)/);

    if (rgbMatch) {
      return rgbMatch[0];
    }

    return null;
  };

  return (
    <div className="fixed right-4 top-20 w-80 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg z-[9999] max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
        <div className="flex items-center gap-2">
          <div className="i-ph:cursor-click text-accent-400" />
          <h3 className="font-medium text-bolt-elements-textPrimary text-sm">Element Inspector</h3>
        </div>
        <button
          onClick={onClose}
          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors p-1 rounded hover:bg-bolt-elements-background-depth-4"
        >
          <div className="i-ph:x w-4 h-4" />
        </button>
      </div>

      {/* Element Info */}
      <div className="p-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <div className="text-sm">
          <div className="font-mono text-xs bg-bolt-elements-background-depth-3 px-2 py-1.5 rounded border border-bolt-elements-borderColor">
            <span className="text-blue-400">{selectedElement.tagName.toLowerCase()}</span>
            {selectedElement.id && <span className="text-green-400">#{selectedElement.id}</span>}
            {selectedElement.className && (
              <span className="text-yellow-400">.{selectedElement.className.split(' ')[0]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b border-bolt-elements-borderColor"
        style={{ background: 'var(--bolt-elements-bg-depth-3)' }}
      >
        {(['styles', 'text', 'box'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors"
            style={{
              background: activeTab === tab ? 'var(--bolt-elements-bg-depth-2)' : 'transparent',
              color: activeTab === tab ? 'var(--color-accent-500, #3b82f6)' : 'var(--bolt-elements-textSecondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent-500, #3b82f6)' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 overflow-y-auto max-h-80 bg-bolt-elements-background-depth-2">
        {activeTab === 'styles' && (
          <div className="space-y-2">
            {Object.entries(getRelevantStyles(selectedElement.styles)).map(([prop, value]) => {
              const editedValue = editedStyles[prop] ?? value;
              const color = isColorProperty(prop) ? parseColorFromValue(editedValue) : null;

              return (
                <div key={prop} className="flex items-center gap-2 text-xs">
                  <span className="text-bolt-elements-textSecondary min-w-[100px] truncate" title={prop}>
                    {prop}:
                  </span>
                  <div className="flex-1 flex items-center gap-1">
                    {color && (
                      <div className="relative w-6 h-6 rounded overflow-hidden border border-bolt-elements-borderColor">
                        <input
                          type="color"
                          value={color.startsWith('#') ? color : '#000000'}
                          onChange={(e) => handleStyleChange(prop, e.target.value)}
                          className="absolute inset-0 w-[200%] h-[200%] -top-1 -left-1 cursor-pointer border-0 p-0 m-0"
                          style={{ background: 'transparent' }}
                          title="Pick color"
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={editedValue}
                      onChange={(e) => handleStyleChange(prop, e.target.value)}
                      className="flex-1 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded px-2 py-1 text-bolt-elements-textPrimary font-mono text-xs focus:outline-none focus:border-accent-400"
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(getRelevantStyles(selectedElement.styles)).length === 0 && (
              <p className="text-bolt-elements-textSecondary text-xs italic">No editable styles found</p>
            )}
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-bolt-elements-textSecondary block mb-1">Text Content</label>
              <textarea
                value={editedText || selectedElement.textContent}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded px-2 py-2 text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-accent-400 resize-none"
                rows={4}
                placeholder="Enter text content..."
              />
            </div>
            <p className="text-bolt-elements-textTertiary text-xs">
              Changes apply instantly to the preview. Note: Only works for simple text elements.
            </p>
          </div>
        )}

        {activeTab === 'box' && (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-bolt-elements-background-depth-3 rounded p-2 border border-bolt-elements-borderColor">
                <span className="text-bolt-elements-textSecondary block">Width</span>
                <span className="text-bolt-elements-textPrimary font-mono">
                  {Math.round(selectedElement.rect.width)}px
                </span>
              </div>
              <div className="bg-bolt-elements-background-depth-3 rounded p-2 border border-bolt-elements-borderColor">
                <span className="text-bolt-elements-textSecondary block">Height</span>
                <span className="text-bolt-elements-textPrimary font-mono">
                  {Math.round(selectedElement.rect.height)}px
                </span>
              </div>
              <div className="bg-bolt-elements-background-depth-3 rounded p-2 border border-bolt-elements-borderColor">
                <span className="text-bolt-elements-textSecondary block">Top</span>
                <span className="text-bolt-elements-textPrimary font-mono">
                  {Math.round(selectedElement.rect.top)}px
                </span>
              </div>
              <div className="bg-bolt-elements-background-depth-3 rounded p-2 border border-bolt-elements-borderColor">
                <span className="text-bolt-elements-textSecondary block">Left</span>
                <span className="text-bolt-elements-textPrimary font-mono">
                  {Math.round(selectedElement.rect.left)}px
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="p-3 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 space-y-2">
        {hasChanges ? (
          <div className="flex gap-2">
            <button
              onClick={handleCopyCSS}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-4 transition-colors"
            >
              <div className="i-ph:clipboard w-3.5 h-3.5" />
              {copyFeedback || 'Copy CSS'}
            </button>
            <button
              onClick={handleApplyWithAI}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors"
            >
              <div className="i-ph:magic-wand w-3.5 h-3.5" />
              Apply with AI
            </button>
          </div>
        ) : (
          <p className="text-bolt-elements-textTertiary text-xs text-center">Edit values above to see live changes</p>
        )}

        {/* Delete Element Button */}
        <button
          onClick={() => onDeleteElement?.(selectedElement)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
        >
          <div className="i-ph:trash w-3.5 h-3.5" />
          Delete Element
        </button>
      </div>
    </div>
  );
};
