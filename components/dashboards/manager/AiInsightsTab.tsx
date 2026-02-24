'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Lightbulb,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Insight = {
  type?: 'opportunity' | 'warning' | 'risk' | string;
  impact?: 'high' | 'medium' | 'low' | string;
  title?: string;
  description?: string;
  recommendation?: string;
};

type AiAnalysis = {
  summary?: string;
  riskScore?: number;
  cashflowHealth?: string;
  generatedAt?: string;
  insights?: Insight[];
};

type Props = {
  aiAnalysisLoading: boolean;
  aiAnalysis: AiAnalysis | null;
  generateAiAnalysis: (analysisType: 'monthly' | 'quarterly' | 'risks') => void;
};

export function ManagerAiInsightsTab({ aiAnalysisLoading, aiAnalysis, generateAiAnalysis }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle>AI Financial Insights</CardTitle>
                <CardDescription>
                  Powered by GROQ AI - Analysis and recommendations for financial performance
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateAiAnalysis('monthly')}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {aiAnalysisLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                Analyze This Month
              </button>
              <button
                onClick={() => generateAiAnalysis('quarterly')}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-2 px-4 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                Quarterly Review
              </button>
              <button
                onClick={() => generateAiAnalysis('risks')}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-2 px-4 py-2 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Risk Analysis
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {aiAnalysisLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Brain className="w-10 h-10 animate-pulse text-purple-600 mx-auto" />
                <p className="text-gray-600 font-medium">AI is analyzing your financial data...</p>
                <p className="text-sm text-gray-500">This may take a few moments</p>
              </div>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Financial Summary
                </h3>
                <p className="text-purple-800 leading-relaxed">{aiAnalysis.summary}</p>

                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-purple-700">Risk Score:</span>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        (aiAnalysis.riskScore ?? 0) >= 70
                          ? 'bg-red-100 text-red-700'
                          : (aiAnalysis.riskScore ?? 0) >= 40
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {(aiAnalysis.riskScore ?? 0)}/100
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-purple-700">Cashflow Health:</span>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${
                        aiAnalysis.cashflowHealth === 'excellent'
                          ? 'bg-green-100 text-green-700'
                          : aiAnalysis.cashflowHealth === 'good'
                            ? 'bg-blue-100 text-blue-700'
                            : aiAnalysis.cashflowHealth === 'concerning'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {aiAnalysis.cashflowHealth}
                    </div>
                  </div>
                </div>
              </div>

              {aiAnalysis.insights && aiAnalysis.insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiAnalysis.insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        insight.type === 'opportunity'
                          ? 'bg-green-50 border-green-400'
                          : insight.type === 'warning'
                            ? 'bg-yellow-50 border-yellow-400'
                            : insight.type === 'risk'
                              ? 'bg-red-50 border-red-400'
                              : 'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {insight.type === 'opportunity' ? (
                          <Lightbulb className="w-5 h-5 text-green-600 mt-0.5" />
                        ) : insight.type === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        ) : insight.type === 'risk' ? (
                          <Shield className="w-5 h-5 text-red-600 mt-0.5" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                        )}

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4
                              className={`font-semibold ${
                                insight.type === 'opportunity'
                                  ? 'text-green-800'
                                  : insight.type === 'warning'
                                    ? 'text-yellow-800'
                                    : insight.type === 'risk'
                                      ? 'text-red-800'
                                      : 'text-blue-800'
                              }`}
                            >
                              {insight.title}
                            </h4>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                insight.impact === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : insight.impact === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {insight.impact} impact
                            </span>
                          </div>
                          <p
                            className={`text-sm mb-2 ${
                              insight.type === 'opportunity'
                                ? 'text-green-700'
                                : insight.type === 'warning'
                                  ? 'text-yellow-700'
                                  : insight.type === 'risk'
                                    ? 'text-red-700'
                                    : 'text-blue-700'
                            }`}
                          >
                            {insight.description}
                          </p>
                          {insight.recommendation && (
                            <div className="text-xs font-medium text-gray-600 bg-white/60 rounded px-2 py-1">
                              💡 {insight.recommendation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500 flex items-center gap-2 pt-4 border-t">
                <Brain className="w-4 h-4" />
                Analysis generated on{' '}
                {aiAnalysis.generatedAt ? new Date(aiAnalysis.generatedAt).toLocaleString() : 'Unknown'}
                <span className="mx-2">•</span>
                Powered by GROQ AI
                <span className="mx-2">•</span>
                <span className="text-purple-600">Safe Mode: Read-Only Analysis</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <Brain className="w-16 h-16 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Financial Insights</h3>
                <p className="text-gray-600 mb-4">
                  Get AI-powered analysis of your financial performance, trends, and risks.
                </p>
                <button
                  onClick={() => generateAiAnalysis('monthly')}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mx-auto"
                >
                  <Activity className="w-4 h-4" />
                  Generate Analysis
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

