import AgentPage from './AgentPage';
import AgentStudioPage from './AgentStudioPage';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * /agent 入口：
 * - 桌面端：智能体控制台（每块地一个助农手 + 知识库）
 * - 手机端：保持原来的聊天页
 */
export default function AgentEntryPage() {
  const isDesktop = useMediaQuery('(min-width: 769px)');
  return isDesktop ? <AgentStudioPage /> : <AgentPage />;
}