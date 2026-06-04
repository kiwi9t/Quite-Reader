// src/types/epub2.d.ts
//
// Minimal ambient type declaration for the `epub2` package.
// Covers only the API surface used by parseEpub.ts.
//
// Run `npm install epub2` before using the EPUB parser.
//
// epub2 包的最小环境类型声明。
// 仅覆盖 parseEpub.ts 使用的 API。
// 使用 EPUB 解析器前请先运行 `npm install epub2`。

declare module "epub2" {
  /**
   * Metadata extracted from the EPUB OPF file.
   * 从 EPUB OPF 文件中提取的元数据。
   */
  interface EPubMetadata {
    title?: string;
    creator?: string;
    language?: string;
    subject?: string;
    description?: string;
    publisher?: string;
    date?: string;
    identifier?: string;
    [key: string]: unknown;
  }

  /**
   * A single item in the EPUB spine (reading order).
   * EPUB spine（阅读顺序）中的单个条目。
   */
  interface EPubFlowItem {
    id: string;
    href?: string;
    title?: string;
    order?: number;
    level?: number;
    [key: string]: unknown;
  }

  /**
   * A single entry in the EPUB table of contents.
   * EPUB 目录中的单个条目。
   */
  interface EPubTocItem {
    id?: string;
    href?: string;
    title?: string;
    order?: number;
    level?: number;
    [key: string]: unknown;
  }

  /**
   * The parsed EPub instance.
   * 解析后的 EPub 实例。
   */
  class EPub {
    /** Metadata from the OPF file. OPF 文件元数据。 */
    metadata: EPubMetadata;

    /** Ordered spine items (reading order). 有序 spine 条目（阅读顺序）。 */
    flow: EPubFlowItem[];

    /** Table of contents entries. 目录条目。 */
    toc: EPubTocItem[];

    /**
     * Factory method: parse an EPUB file asynchronously.
     * 工厂方法：异步解析 EPUB 文件。
     *
     * @param filepath       Path to the .epub file  .epub 文件路径
     * @param imageWebRoot   Web root for image URLs (optional)  图片 URL 的 Web 根路径（可选）
     * @param chapterWebRoot Web root for chapter URLs (optional)  章节 URL 的 Web 根路径（可选）
     */
    static createAsync(
      filepath: string,
      imageWebRoot?: string,
      chapterWebRoot?: string
    ): Promise<EPub>;

    /**
     * Get the HTML content of a chapter by its spine item id.
     * 通过 spine 条目 id 获取章节的 HTML 内容。
     */
    getChapterAsync(id: string): Promise<string>;
  }

  export = EPub;
}
