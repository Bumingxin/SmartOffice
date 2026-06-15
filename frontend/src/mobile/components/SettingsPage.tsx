import { Bot, ChevronRight, Command, Cpu, Info, Network, Settings } from 'lucide-react';
import type { AppConfig, ModelSummary, QuickCommand, SettingsSection } from '../types';

interface SettingsPageProps {
  config: AppConfig | null;
  models: ModelSummary[];
  commands: QuickCommand[];
  onOpen: (section: SettingsSection) => void;
}

const sections: Array<{ id: SettingsSection; title: string; description: string; Icon: typeof Network }> = [
  { id: 'gateway', title: '网关', description: 'OpenClaw 连接、Token 与访问控制', Icon: Network },
  { id: 'general', title: '通用', description: '语言、名称、登录与历史窗口', Icon: Settings },
  { id: 'models', title: '模型', description: '查看可用模型和默认智能体', Icon: Cpu },
  { id: 'commands', title: '快捷命令', description: '管理常用命令模板', Icon: Command },
  { id: 'about', title: '关于', description: '版本、服务状态与项目信息', Icon: Info },
];

export function SettingsPage({ config, models, commands, onOpen }: SettingsPageProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f4ef] px-3 py-3">
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-gray-950 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-950">{config?.aiName || 'SmartOffice'}</div>
            <div className="text-xs text-gray-500">{models.length} 个模型 · {commands.length} 条命令</div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {sections.map(({ id, title, description, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-left"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-950">{title}</span>
              <span className="block truncate text-xs text-gray-500">{description}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
