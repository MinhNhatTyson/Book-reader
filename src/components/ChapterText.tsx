interface Props {
  title: string
  paragraphs: string[]
}

export default function ChapterText({ title, paragraphs }: Props) {
  return (
    <>
      <h2 className="chapter-title">{title}</h2>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  )
}