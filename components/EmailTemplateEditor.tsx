import React, { useState } from 'react';
import { EmailTemplate } from '../types';

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onSave: (updated: EmailTemplate) => void;
  onSendTest: (template: EmailTemplate) => void;
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({ template, onSave, onSendTest }) => {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.bodyHtml);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 space-y-6 font-[\'Plus Jakarta Sans\'],sans-serif">
      <h2 className="text-2xl font-extrabold text-fcGold mb-2">Edit Email Template</h2>
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase text-gray-600">Subject</label>
        <input
          className="w-full border border-fcDivider rounded-lg px-4 py-2 text-sm font-bold"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase text-gray-600">HTML Body</label>
        <textarea
          className="w-full border border-fcDivider rounded-lg px-4 py-2 text-sm font-mono min-h-[200px]"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>
      <div className="flex gap-4 mt-4">
        <button
          className="bg-fcGold text-white px-6 py-2 rounded-lg font-bold uppercase tracking-widest hover:brightness-110 transition"
          onClick={() => onSave({ ...template, subject, bodyHtml: body })}
        >
          Save
        </button>
        <button
          className="bg-brand-black text-white px-6 py-2 rounded-lg font-bold uppercase tracking-widest hover:opacity-90 transition"
          onClick={() => onSendTest({ ...template, subject, bodyHtml: body })}
        >
          Send Test
        </button>
      </div>
      <div className="text-xs text-brand-grey mt-2">Use <span className="font-mono bg-brand-light px-1 rounded">{`{variable}`}</span> for dynamic fields.</div>
    </div>
  );
};
