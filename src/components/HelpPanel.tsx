import { ArrowLeft, Brain, Library, PenLine, Settings } from 'lucide-react'

type Theme = 'light' | 'dark'

const sections = [
  {
    icon: Brain,
    title: '今日',
    items: [
      { label: '计划', desc: '使用 /plan 命令创建和管理今日工作计划。' },
      { label: '备忘', desc: '添加待办事项，点击左侧圆圈标记完成。' },
      { label: '斜杠命令', desc: '在输入框中输入 / 查看所有可用命令：/plan 创建计划，/task 拆解任务，/memo 添加备忘，/sum 总结内容，/write 生成写作。' },
    ],
  },
  {
    icon: Library,
    title: '阅读',
    items: [
      { label: '导入', desc: '点击顶部「导入」按钮添加 PDF 文件到阅读列表。' },
      { label: '管理', desc: '在阅读列表中查看、打开或删除已导入的文档。' },
      { label: '搜索', desc: '在今日页面搜索论文，支持多源并发检索。' },
    ],
  },
  {
    icon: PenLine,
    title: '写作',
    items: [
      { label: '写作库', desc: '管理所有写作文档，支持分组和重命名。' },
      { label: '富文本编辑', desc: '支持标题、加粗、斜体、列表、引用等格式。' },
      { label: 'AI 辅助', desc: '选中文字后右键可使用 AI 翻译、润色或续写。' },
      { label: '导出', desc: '支持导出为 HTML 或 PDF 文件。' },
    ],
  },
  {
    icon: Settings,
    title: '设置',
    items: [
      { label: '模型配置', desc: '配置 AI 服务地址、API Key 和模型参数。' },
      { label: '外观', desc: '支持深色与浅色主题，点击顶部开关切换。' },
    ],
  },
]

export function HelpPanel({ theme, onBack }: { theme: Theme; onBack: () => void }) {
  return (
    <section className={`help-panel page-primary ${theme === 'light' ? 'theme-light' : ''}`}>
      <div className="help-panel-header">
        <button
          type="button"
          className="help-back-btn"
          onClick={onBack}
          aria-label="返回"
        >
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <h2>知页 使用手册</h2>
      </div>

      <div className="help-panel-sections">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <article key={section.title} className="content-panel help-section">
              <div className="help-section-head">
                <Icon size={20} />
                <h3>{section.title}</h3>
              </div>
              <ul className="help-section-list">
                {section.items.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.desc}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
