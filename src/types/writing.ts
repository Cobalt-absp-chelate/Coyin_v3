export type WritingDocument = {
  id: string
  title: string
  group: string
  contentHtml: string
  createdAt: number
  updatedAt: number
}

export const WRITING_GROUPS = ['全部', '默认', '学习', '项目', '论文', '其他'] as const

export function createWritingDocument(overrides?: Partial<WritingDocument>): WritingDocument {
  const now = Date.now()
  return {
    id: `doc-${now}`,
    title: '未命名写作',
    group: '默认',
    contentHtml: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
