import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import ForceGraph3D from 'react-force-graph-3d';
import ReactMarkdown from 'react-markdown';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Play, 
  Square, 
  RefreshCw, 
  AlertCircle,
  BrainCircuit,
  Plus,
  Trash2,
  Info,
  FileText,
  Activity,
  X
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  persona: string;
  color: string;
  hex: string;
};

type Message = {
  id: string;
  round: number;
  fromId: string;
  fromName: string;
  toId?: string;
  toName?: string;
  text: string;
};

type AppState = 'setup' | 'analyzing' | 'finished' | 'error';

const AVAILABLE_PERSONAS = [
  { name: 'Optimist', persona: 'An optimistic visionary who focuses on potential benefits.', color: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Skeptic', persona: 'A skeptical pragmatist who points out flaws and risks.', color: 'bg-red-500', hex: '#ef4444' },
  { name: 'Analyst', persona: 'A data-driven analyst who relies on facts and logic.', color: 'bg-green-500', hex: '#22c55e' },
  { name: 'Ethicist', persona: 'A moral philosopher who evaluates ethical implications.', color: 'bg-purple-500', hex: '#a855f7' },
  { name: 'Devil\'s Advocate', persona: 'A contrarian who takes the opposing view.', color: 'bg-orange-500', hex: '#f97316' },
  { name: 'Innovator', persona: 'A creative thinker looking for novel applications.', color: 'bg-teal-500', hex: '#14b8a6' },
  { name: 'Traditionalist', persona: 'Values history, precedent, and established methods.', color: 'bg-amber-500', hex: '#f59e0b' },
];

type GraphNode = {
  id: string;
  name: string;
  group: 'topic' | 'agent' | 'idea';
  color: string;
  val: number;
  label: string;
};

type GraphLink = {
  source: string;
  target: string;
  color: string;
  label?: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export default function App() {
  const [status, setStatus] = useState<AppState>('setup');
  const [topic, setTopic] = useState('The impact of Artificial General Intelligence on human creativity.');
  const [agents, setAgents] = useState<Agent[]>([
    { id: '1', name: 'Alpha', persona: AVAILABLE_PERSONAS[0].persona, color: AVAILABLE_PERSONAS[0].color, hex: AVAILABLE_PERSONAS[0].hex },
    { id: '2', name: 'Beta', persona: AVAILABLE_PERSONAS[1].persona, color: AVAILABLE_PERSONAS[1].color, hex: AVAILABLE_PERSONAS[1].hex },
    { id: '3', name: 'Gamma', persona: AVAILABLE_PERSONAS[2].persona, color: AVAILABLE_PERSONAS[2].color, hex: AVAILABLE_PERSONAS[2].hex },
  ]);
  
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [researchOutput, setResearchOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  
  const isAnalyzingRef = useRef(false);
  const graphRef = useRef<any>();

  const startAnalysis = async () => {
    if (!topic.trim() || agents.length < 2) return;
    
    setStatus('analyzing');
    setSelectedNode(null);
    setError(null);
    setMessages([]);
    setResearchOutput('');
    isAnalyzingRef.current = true;
    
    const newNodes: GraphNode[] = [
      { id: 'topic', name: topic, label: 'Topic', group: 'topic', color: '#ffffff', val: 20 }
    ];
    const newLinks: GraphLink[] = [];
    const currentMessages: Message[] = [];
    
    // Initialize Agent Nodes
    agents.forEach(agent => {
      newNodes.push({ id: agent.id, name: agent.name, label: 'Agent', group: 'agent', color: agent.hex, val: 10 });
      newLinks.push({ source: agent.id, target: 'topic', color: '#475569' }); // Initial link to topic
    });
    
    setGraphData({ nodes: [...newNodes], links: [...newLinks] });
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // ROUND 1: Initial Perspectives
      setProgressText('Round 1: Gathering initial perspectives...');
      for (let i = 0; i < agents.length; i++) {
        if (!isAnalyzingRef.current) return;
        const agent = agents[i];
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Topic: "${topic}"\n\nYou are ${agent.name}. Your persona is: ${agent.persona}.\nProvide your initial perspective on the topic. Keep it extremely short, simple, and easy to understand. Maximum 1 or 2 sentences.`,
        });
        
        const text = response.text || '';
        const msgId = `msg-r1-${agent.id}`;
        
        currentMessages.push({
          id: msgId,
          round: 1,
          fromId: agent.id,
          fromName: agent.name,
          toId: 'topic',
          toName: 'Topic',
          text
        });
        setMessages([...currentMessages]);

        // Add Idea Node for Round 1
        newNodes.push({ id: msgId, name: text, label: `${agent.name}'s Perspective`, group: 'idea', color: agent.hex, val: 5 });
        newLinks.push({ source: agent.id, target: msgId, color: agent.hex });
        newLinks.push({ source: msgId, target: 'topic', color: '#475569' });
        setGraphData({ nodes: [...newNodes], links: [...newLinks] });
      }

      // ROUND 2: Cross-Debate
      setProgressText('Round 2: Facilitating cross-debate...');
      for (let i = 0; i < agents.length; i++) {
        if (!isAnalyzingRef.current) return;
        const agent = agents[i];
        
        // Format what others said
        const othersMessages = currentMessages
          .filter(m => m.round === 1 && m.fromId !== agent.id)
          .map(m => `[${m.fromName}]: ${m.text}`)
          .join('\n');

        const prompt = `Topic: "${topic}"\n\nYou are ${agent.name} (${agent.persona}).\n\nHere are the initial statements from other agents:\n${othersMessages}\n\nChoose EXACTLY ONE agent to debate, rebut, or agree with. You MUST reply in this EXACT format:\nTARGET: [Exact Name of Agent]\nMESSAGE: [Your 1-2 sentence argument]`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        
        const replyText = response.text || '';
        
        // Parse TARGET and MESSAGE
        const targetMatch = replyText.match(/TARGET:\s*(.+)/i);
        const messageMatch = replyText.match(/MESSAGE:\s*([\s\S]+)/i);
        
        let targetName = targetMatch ? targetMatch[1].trim() : '';
        let actualMessage = messageMatch ? messageMatch[1].trim() : replyText;
        
        // Find target agent ID
        const targetAgent = agents.find(a => a.name.toLowerCase() === targetName.toLowerCase());
        const msgId = `msg-r2-${agent.id}`;
        
        if (targetAgent) {
          currentMessages.push({
            id: msgId,
            round: 2,
            fromId: agent.id,
            fromName: agent.name,
            toId: targetAgent.id,
            toName: targetAgent.name,
            text: actualMessage
          });
          
          // Add Idea Node for Round 2
          newNodes.push({ id: msgId, name: actualMessage, label: `${agent.name}'s Reply`, group: 'idea', color: agent.hex, val: 5 });
          newLinks.push({ source: agent.id, target: msgId, color: agent.hex });
          newLinks.push({ source: msgId, target: targetAgent.id, color: targetAgent.hex }); // Link to target agent
          setGraphData({ nodes: [...newNodes], links: [...newLinks] });
        } else {
          // Fallback if parsing fails
          currentMessages.push({
            id: msgId,
            round: 2,
            fromId: agent.id,
            fromName: agent.name,
            toId: 'topic',
            toName: 'Topic',
            text: actualMessage
          });

          newNodes.push({ id: msgId, name: actualMessage, label: `${agent.name}'s Reply`, group: 'idea', color: agent.hex, val: 5 });
          newLinks.push({ source: agent.id, target: msgId, color: agent.hex });
          newLinks.push({ source: msgId, target: 'topic', color: '#475569' });
          setGraphData({ nodes: [...newNodes], links: [...newLinks] });
        }
        setMessages([...currentMessages]);
      }
      
      if (!isAnalyzingRef.current) return;
      
      // OVERSEER: Research Compilation
      setProgressText('Overseer compiling research report...');
      
      const transcript = currentMessages.map(m => 
        `Round ${m.round} | ${m.fromName} ${m.toName !== 'Topic' ? `(to ${m.toName})` : ''}: ${m.text}`
      ).join('\n');

      const researchPrompt = `You are the Research Overseer.\nTopic: "${topic}"\n\nDebate Transcript:\n${transcript}\n\nWrite a comprehensive, well-structured research report based on this debate. Include:\n1. Executive Summary\n2. Key Perspectives\n3. Points of Contention\n4. Final Synthesized Conclusion\n\nUse Markdown formatting. Keep it professional and insightful.`;

      const researchResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: researchPrompt,
      });
      
      setResearchOutput(researchResponse.text || 'Failed to generate research.');
      
      setStatus('finished');
      setProgressText('');
      isAnalyzingRef.current = false;
      
      // Auto-focus the graph
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400);
        }
      }, 500);
      
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during analysis.');
      setStatus('error');
      setProgressText('');
      isAnalyzingRef.current = false;
    }
  };

  const stopAnalysis = () => {
    isAnalyzingRef.current = false;
    setStatus('finished');
    setProgressText('');
  };

  const resetAnalysis = () => {
    setStatus('setup');
    setGraphData({ nodes: [], links: [] });
    setSelectedNode(null);
    setMessages([]);
    setResearchOutput('');
    setError(null);
  };

  const addAgent = () => {
    const newId = Math.random().toString(36).substring(7);
    const persona = AVAILABLE_PERSONAS[agents.length % AVAILABLE_PERSONAS.length];
    setAgents([...agents, { id: newId, name: `Agent ${agents.length + 1}`, persona: persona.persona, color: persona.color, hex: persona.hex }]);
  };

  const removeAgent = (id: string) => {
    if (agents.length <= 2) return; // Minimum 2 agents for a debate
    setAgents(agents.filter(a => a.id !== id));
  };

  const updateAgent = (id: string, field: keyof Agent, value: string) => {
    setAgents(agents.map(a => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        if (field === 'persona') {
          const matchedPersona = AVAILABLE_PERSONAS.find(p => p.persona === value);
          if (matchedPersona) {
            updated.color = matchedPersona.color;
            updated.hex = matchedPersona.hex;
          }
        }
        return updated;
      }
      return a;
    }));
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode);
    // Aim at node
    const distance = 60;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        2000
      );
    }
  }, [graphRef]);

  // Filter messages for the selected node
  const selectedNodeMessages = selectedNode 
    ? messages.filter(m => m.fromId === selectedNode.id || m.toId === selectedNode.id)
    : [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-20 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-white">Multi-Agent Research Network</h1>
            <p className="text-xs text-slate-400 font-medium">Powered by Gemini Flash</p>
          </div>
        </div>
        {status !== 'setup' && (
          <button 
            onClick={resetAnalysis}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
          >
            <Settings size={16} />
            Setup
          </button>
        )}
      </header>

      <main className="flex-1 flex relative overflow-hidden">
        {status === 'setup' ? (
          <div className="max-w-5xl w-full mx-auto p-6 flex-1 flex flex-col justify-center overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <MessageSquare size={20} className="text-indigo-400" />
                    Research Topic
                  </h2>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none min-h-[120px] text-slate-100"
                    placeholder="Enter a topic to research and debate..."
                  />
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                      <Users size={20} className="text-indigo-400" />
                      Agents ({agents.length})
                    </h2>
                    <button 
                      onClick={addAgent}
                      className="text-sm flex items-center gap-1 text-indigo-300 font-medium hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={16} /> Add Agent
                    </button>
                  </div>
                  
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {agents.map((agent) => (
                      <div key={agent.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-slate-700 bg-slate-900/50">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${agent.color}`}>
                              {agent.name.charAt(0)}
                            </div>
                            <input
                              type="text"
                              value={agent.name}
                              onChange={(e) => updateAgent(agent.id, 'name', e.target.value)}
                              className="font-medium bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 outline-none px-1 py-0.5 transition-colors text-white"
                              placeholder="Agent Name"
                            />
                          </div>
                          <select
                            value={agent.persona}
                            onChange={(e) => updateAgent(agent.id, 'persona', e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 outline-none focus:border-indigo-500"
                          >
                            {AVAILABLE_PERSONAS.map(p => (
                              <option key={p.name} value={p.persona}>{p.name} - {p.persona.substring(0, 50)}...</option>
                            ))}
                          </select>
                        </div>
                        {agents.length > 2 && (
                          <button 
                            onClick={() => removeAgent(agent.id)}
                            className="text-slate-500 hover:text-red-400 p-2 self-start sm:self-center transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <Info size={20} className="text-indigo-400" />
                    How it works
                  </h2>
                  <ul className="text-sm text-slate-300 leading-relaxed space-y-3 list-disc pl-4">
                    <li><strong>Round 1:</strong> Agents provide initial perspectives connected to the center topic.</li>
                    <li><strong>Round 2:</strong> Agents debate each other directly, creating node-to-node links.</li>
                    <li><strong>Overseer:</strong> A main module outside the map monitors the debate and compiles a proper research report.</li>
                  </ul>
                </div>

                <button
                  onClick={startAnalysis}
                  disabled={!topic.trim()}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-2xl font-semibold text-lg shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Play size={20} />
                  Start Research Network
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row w-full h-full overflow-hidden">
            
            {/* 3D Graph Area (Left/Top) */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden border-r border-slate-800">
              {/* Graph Overlay UI */}
              <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl pointer-events-auto max-w-sm shadow-xl">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Central Topic</h3>
                  <p className="text-sm font-medium text-white line-clamp-2">{topic}</p>
                </div>

                <div className="pointer-events-auto flex flex-col gap-2">
                  {status === 'analyzing' && (
                    <button
                      onClick={stopAnalysis}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors shadow-lg"
                    >
                      <Square size={14} fill="currentColor" /> Stop
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Node Panel (Floating over 3D Map) */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-6 left-6 right-6 lg:left-1/2 lg:-translate-x-1/2 lg:w-[500px] z-10 pointer-events-auto"
                  >
                    <div className="bg-slate-800/95 backdrop-blur-xl border border-slate-600 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[40vh]">
                      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                          <span className="font-bold text-white">
                            {selectedNode.group === 'idea' ? 'Message' : selectedNode.name}
                          </span>
                          <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-700 rounded-full">{selectedNode.label}</span>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white p-1">
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
                        {selectedNode.group === 'idea' || selectedNode.group === 'topic' ? (
                          <p className="text-lg text-white font-medium leading-relaxed">
                            {selectedNode.name}
                          </p>
                        ) : selectedNodeMessages.length > 0 ? (
                          selectedNodeMessages.map(msg => (
                            <div key={msg.id} className={`p-3 rounded-xl text-sm ${msg.fromId === selectedNode.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-slate-700/50 border border-slate-600'}`}>
                              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-400">
                                <span>Round {msg.round}</span>
                                <span>•</span>
                                <span className={msg.fromId === selectedNode.id ? 'text-indigo-300' : 'text-slate-300'}>{msg.fromName}</span>
                                {msg.toName !== 'Topic' && (
                                  <>
                                    <span>→</span>
                                    <span className={msg.toId === selectedNode.id ? 'text-indigo-300' : 'text-slate-300'}>{msg.toName}</span>
                                  </>
                                )}
                              </div>
                              <p className="text-slate-200 leading-relaxed">{msg.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-sm italic text-center py-4">No conversation history available for this node.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-900/90 backdrop-blur-md text-red-100 p-6 rounded-2xl flex items-start gap-3 border border-red-500 shadow-2xl max-w-md">
                  <AlertCircle size={24} className="shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <h4 className="font-bold text-lg mb-1">Analysis Error</h4>
                    <p className="text-sm leading-relaxed">{error}</p>
                    <button 
                      onClick={resetAnalysis}
                      className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              )}

              {/* 3D Graph */}
              <div className="w-full h-full cursor-move">
                <ForceGraph3D
                  ref={graphRef}
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor="color"
                  nodeVal="val"
                  linkColor="color"
                  linkWidth={2}
                  linkOpacity={0.6}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  backgroundColor="#020617" // slate-950
                  onNodeClick={handleNodeClick}
                  nodeResolution={16}
                />
              </div>
            </div>

            {/* Overseer Research Module (Right/Bottom) */}
            <div className="w-full lg:w-[450px] xl:w-[500px] bg-slate-900 flex flex-col shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 z-10 h-[50vh] lg:h-auto">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-3">
                <div className="bg-teal-500/20 text-teal-400 p-2 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-white">Research Monitor</h2>
                  <p className="text-xs text-slate-400">Overseer Module</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {status === 'analyzing' ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6">
                    <div className="relative">
                      <Activity size={48} className="text-teal-500 animate-pulse" />
                      <div className="absolute inset-0 border-4 border-teal-500/30 rounded-full animate-ping"></div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-medium text-teal-400">{progressText}</p>
                      <p className="text-xs text-slate-500 max-w-[250px] mx-auto">
                        The overseer is monitoring the debate network and compiling the final research report.
                      </p>
                    </div>
                    
                    {/* Live log of messages */}
                    <div className="w-full mt-8 space-y-2">
                      {messages.slice(-3).map(msg => (
                        <div key={msg.id} className="text-xs bg-slate-800/50 p-2 rounded border border-slate-700/50 text-slate-300 truncate">
                          <span className="text-indigo-400">{msg.fromName}</span>: {msg.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : status === 'finished' && researchOutput ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-invert prose-sm max-w-none prose-headings:text-teal-400 prose-a:text-indigo-400"
                  >
                    <ReactMarkdown>{researchOutput}</ReactMarkdown>
                  </motion.div>
                ) : null}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
