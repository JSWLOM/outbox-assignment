import { ReactNode } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, IndentDecrease, IndentIncrease, Italic, List, ListOrdered,
  Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';

interface Props {
  /** Receives HTML, or '' when the editor is empty. */
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolBtn({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // keep editor focus/selection
      onClick={onClick}
      className={`rounded p-1.5 text-neutral-600 hover:bg-neutral-100 ${active ? 'bg-neutral-200 text-black' : ''}`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-neutral-200" />;

function Toolbar({ editor }: { editor: Editor }) {
  const align = editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left';
  const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left';
  const AlignIcon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
  const heading = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? 0;

  const setBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === '0') chain.setParagraph().run();
    else chain.setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
  };

  return (
    <div className="mx-3 mt-3 flex flex-wrap items-center gap-0.5 rounded-full bg-white px-3 py-1.5">
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolBtn>
      <Divider />
      <select
        aria-label="Text size"
        value={heading}
        onChange={(e) => setBlock(e.target.value)}
        className="rounded bg-transparent px-1 py-1 text-xs text-neutral-600 outline-none hover:bg-neutral-100"
      >
        <option value={0}>Normal</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      <Divider />
      <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolBtn>
      <Divider />
      <ToolBtn title={`Align ${align} (click for ${nextAlign})`} onClick={() => editor.chain().focus().setTextAlign(nextAlign).run()}><AlignIcon size={15} /></ToolBtn>
      <Divider />
      <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
      <ToolBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
      <ToolBtn title="Indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}><IndentIncrease size={15} /></ToolBtn>
      <ToolBtn title="Outdent" onClick={() => editor.chain().focus().liftListItem('listItem').run()}><IndentDecrease size={15} /></ToolBtn>
      <Divider />
      <ToolBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolBtn>
    </div>
  );
}

export function RichTextEditor({ onChange, placeholder = 'Type Your Reply...' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: 'tiptap rich' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  if (!editor) return null;
  return (
    <div className="rounded-xl bg-surface pb-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
