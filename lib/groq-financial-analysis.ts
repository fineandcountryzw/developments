/**
 * GROQ Financial Analysis Service - SAFE MODE
 * 
 * CRITICAL SAFETY RULES:
 * 1. READ-ONLY: Never writes to database
 * 2. ANALYSIS ONLY: Never changes actual numbers
 * 3. NON-BLOCKING: Failures don't break workflows
 * 4. OPTIONAL: Easy to disable entirely
 * 5. LOGGED: All calls are logged for audit
 */

import { logger } from './logger';

// Types for financial analysis
export interface FinancialData {
  totalRevenue: number;
  outstandingBalances: number;
  installmentsDue: number;
  agentPerformance: Array<{
    name: string;
    revenue: number;
    deals: number;
    conversionRate: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    deals: number;
  }>;
}

export interface AnalysisInsight {
  type: 'trend' | 'warning' | 'opportunity' | 'risk';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface FinancialAnalysisResult {
  summary: string;
  insights: AnalysisInsight[];
  riskScore: number; // 0-100
  cashflowHealth: 'excellent' | 'good' | 'concerning' | 'critical';
  generatedAt: string;
  dataSnapshot: FinancialData;
}

// Environment check - can be disabled via env var
const GROQ_ENABLED = process.env.ENABLE_GROQ_ANALYSIS === 'true';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Main analysis function - SAFE MODE
 */
export async function analyzeFinancialData(
  data: FinancialData,
  analysisType: 'monthly' | 'quarterly' | 'risks' = 'monthly'
): Promise<FinancialAnalysisResult | null> {
  // Safety check - disabled by default
  if (!GROQ_ENABLED) {
    logger.warn('GROQ analysis disabled via environment variable', { module: 'groq-analysis' });
    return null;
  }

  if (!GROQ_API_KEY) {
    logger.error('GROQ API key not configured', { module: 'groq-analysis' });
    return null;
  }

  const startTime = Date.now();
  
  try {
    logger.info('Starting GROQ financial analysis', {
      module: 'groq-analysis',
      type: analysisType,
      dataPoints: {
        revenue: data.totalRevenue,
        agents: data.agentPerformance.length,
        trendsMonths: data.monthlyTrends.length
      }
    });

    // Create analysis prompt
    const prompt = buildAnalysisPrompt(data, analysisType);
    
    // Call GROQ API with safety timeout
    const response = await callGroqAPI(prompt);
    
    if (!response) {
      return null;
    }

    // Parse and validate response
    const result = parseGroqResponse(response, data);
    
    // Log successful analysis
    logger.info('GROQ financial analysis completed', {
      module: 'groq-analysis',
      type: analysisType,
      duration: Date.now() - startTime,
      insightsCount: result.insights.length,
      riskScore: result.riskScore
    });

    return result;

  } catch (error) {
    // Non-blocking error handling
    logger.error('GROQ financial analysis failed', error instanceof Error ? error : undefined, { 
      module: 'groq-analysis',
      type: analysisType,
      duration: Date.now() - startTime
    });
    return null;
  }
}

/**
 * Build analysis prompt based on data and type
 */
function buildAnalysisPrompt(data: FinancialData, type: string): string {
  const context = `
You are a financial analyst for a real estate company. Analyze the following data and provide insights:

FINANCIAL OVERVIEW:
- Total Revenue: $${data.totalRevenue.toLocaleString()}
- Outstanding Balances: $${data.outstandingBalances.toLocaleString()}
- Installments Due: $${data.installmentsDue.toLocaleString()}

AGENT PERFORMANCE:
${data.agentPerformance.map(agent => 
  `- ${agent.name}: $${agent.revenue.toLocaleString()} revenue, ${agent.deals} deals, ${agent.conversionRate}% conversion`
).join('\n')}

MONTHLY TRENDS:
${data.monthlyTrends.map(trend => 
  `- ${trend.month}: $${trend.revenue.toLocaleString()} revenue, ${trend.deals} deals`
).join('\n')}

ANALYSIS TYPE: ${type}

Please provide:
1. A brief summary (2-3 sentences)
2. Key insights with categories: trend, warning, opportunity, or risk
3. Risk assessment (0-100 score)
4. Overall cashflow health: excellent, good, concerning, or critical
5. Actionable recommendations

Respond in JSON format with this structure:
{
  "summary": "Brief overview...",
  "insights": [
    {
      "type": "trend|warning|opportunity|risk",
      "title": "Insight title",
      "description": "Detailed description",
      "impact": "high|medium|low",
      "recommendation": "Optional recommendation"
    }
  ],
  "riskScore": 0-100,
  "cashflowHealth": "excellent|good|concerning|critical"
}`;

  return context;
}

/**
 * Call GROQ API with safety measures
 */
async function callGroqAPI(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Fast model for analysis
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Respond only in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.2, // Low temperature for consistent analysis
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('GROQ API error', {
        status: response.status,
        statusText: response.statusText
      }, { module: 'groq-analysis' });
      return null;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;

  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.warn('GROQ API call timed out', { module: 'groq-analysis' });
    } else {
      logger.error('GROQ API call failed', error instanceof Error ? error : undefined, { module: 'groq-analysis' });
    }
    return null;
  }
}

/**
 * Parse and validate GROQ response
 */
function parseGroqResponse(response: string, originalData: FinancialData): FinancialAnalysisResult {
  try {
    const parsed = JSON.parse(response);
    
    // Validate structure and provide safe defaults
    return {
      summary: parsed.summary || 'Analysis completed successfully.',
      insights: Array.isArray(parsed.insights) ? parsed.insights.map(validateInsight) : [],
      riskScore: Math.max(0, Math.min(100, parsed.riskScore || 50)),
      cashflowHealth: ['excellent', 'good', 'concerning', 'critical'].includes(parsed.cashflowHealth) 
        ? parsed.cashflowHealth : 'good',
      generatedAt: new Date().toISOString(),
      dataSnapshot: originalData
    };
  } catch (error) {
    logger.error('Failed to parse GROQ response', error instanceof Error ? error : undefined, { module: 'groq-analysis' });
    
    // Return safe fallback
    return {
      summary: 'Financial analysis completed. Review key metrics for insights.',
      insights: [],
      riskScore: 50,
      cashflowHealth: 'good',
      generatedAt: new Date().toISOString(),
      dataSnapshot: originalData
    };
  }
}

/**
 * Validate individual insight
 */
function validateInsight(insight: any): AnalysisInsight {
  return {
    type: ['trend', 'warning', 'opportunity', 'risk'].includes(insight.type) ? insight.type : 'trend',
    title: String(insight.title || 'Financial Insight'),
    description: String(insight.description || 'No description available'),
    impact: ['high', 'medium', 'low'].includes(insight.impact) ? insight.impact : 'medium',
    recommendation: insight.recommendation ? String(insight.recommendation) : undefined
  };
}

/**
 * Utility function to check if GROQ is available
 */
export function isGroqAnalysisEnabled(): boolean {
  return GROQ_ENABLED && !!GROQ_API_KEY;
}

/**
 * Get analysis status for UI display
 */
export function getAnalysisStatus(): { enabled: boolean; configured: boolean; reason?: string } {
  if (!GROQ_ENABLED) {
    return { enabled: false, configured: false, reason: 'Disabled in environment settings' };
  }
  
  if (!GROQ_API_KEY) {
    return { enabled: false, configured: false, reason: 'API key not configured' };
  }
  
  return { enabled: true, configured: true };
}