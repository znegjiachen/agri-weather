/**
 * 帖子正文渲染。
 *
 * 只有 HTML 格式才走 innerHTML —— 内容已在服务端用白名单净化过。
 * 历史帖子是纯文本，必须继续按文本渲染，否则正文里的 `<` 会被当成标签。
 *
 * 图片点击交给父组件打开大图（lightbox），类似小红书/掘金的看图体验。
 */
export default function PostContent({ content, contentFormat, onImageClick }) {
  if (contentFormat === 'HTML') {
    return (
      <div
        className="community-rich"
        onClick={(event) => {
          if (event.target.tagName === 'IMG' && onImageClick) {
            onImageClick(event.target.currentSrc || event.target.src);
          }
        }}
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />
    );
  }
  return (
    <p className="community-post-text community-post-full community-plain-text">
      {content}
    </p>
  );
}