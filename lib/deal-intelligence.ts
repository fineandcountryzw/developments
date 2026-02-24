/**
 * Deal Intelligence Engine
 * Calculates probability, health score, risk level, and forecasting metrics
 */

export interface DealMetrics {
  winProbability: number;
  healthScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  expectedValue: number;
  stageDuration: number;
  overallDuration: number;
  velocityIndicator: 'fast' | 'normal' | 'slow';
  healthFactors: {
    recentActivity: number;
    collaborators: number;
    expectedClose: number;
    probability: number;
  };
}

/**
 * Calculate win probability based on stage and historical data
 */
export function calculateWinProbability(
  stageIndex: number,
  totalStages: number,
  manualProbability: number
): number {
  // Stage-based probability (stage progression increases probability)
  const stageProbability = (stageIndex / totalStages) * 30;
  
  // Use provided probability weighted with stage progression
  const weighted = (manualProbability * 0.7) + stageProbability;
  
  return Math.round(Math.min(99, weighted));
}

/**
 * Calculate deal health score (0-100)
 */
export function calculateHealthScore(
  deal: any,
  daysSinceCreated: number,
  hasRecentActivity: boolean,
  collaboratorCount: number,
  daysUntilExpectedClose: number | null
): number {
  let score = 50; // Base score

  // Activity factor (20 points)
  if (hasRecentActivity) {
    score += 15; // Recent engagement is good
  }

  // Collaboration factor (15 points)
  const colabFactor = Math.min(15, collaboratorCount * 3);
  score += colabFactor;

  // Expected close date factor (20 points)
  if (daysUntilExpectedClose !== null) {
    if (daysUntilExpectedClose > 0 && daysUntilExpectedClose <= 14) {
      score += 20; // Close in 2 weeks = very healthy
    } else if (daysUntilExpectedClose > 14 && daysUntilExpectedClose <= 30) {
      score += 15;
    } else if (daysUntilExpectedClose < 0) {
      score -= 20; // Overdue = concerning
    }
  }

  // Probability alignment (15 points)
  const prob = deal.probability || 50;
  if (prob >= 70) {
    score += 15;
  } else if (prob >= 50) {
    score += 10;
  } else if (prob < 30) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determine risk level
 */
export function calculateRiskLevel(
  healthScore: number,
  daysSinceCreated: number,
  daysUntilExpectedClose: number | null,
  probability: number
): 'low' | 'medium' | 'high' {
  let riskFactors = 0;

  // Health score risk
  if (healthScore < 40) riskFactors += 2;
  else if (healthScore < 60) riskFactors += 1;

  // Age risk (deal sitting too long)
  if (daysSinceCreated > 90) riskFactors += 2;
  else if (daysSinceCreated > 60) riskFactors += 1;

  // Expected close overdue
  if (daysUntilExpectedClose !== null && daysUntilExpectedClose < -7) riskFactors += 2;
  else if (daysUntilExpectedClose !== null && daysUntilExpectedClose < 0) riskFactors += 1;

  // Low probability
  if (probability < 30) riskFactors += 2;
  else if (probability < 50) riskFactors += 1;

  if (riskFactors >= 4) return 'high';
  if (riskFactors >= 2) return 'medium';
  return 'low';
}

/**
 * Calculate velocity indicator
 */
export function calculateVelocityIndicator(
  daysSinceCreated: number,
  currentStageIndex: number,
  totalStages: number
): 'fast' | 'normal' | 'slow' {
  const expectedDaysPerStage = (daysSinceCreated / (currentStageIndex + 1)) || 1;

  if (expectedDaysPerStage < 10) return 'fast';
  if (expectedDaysPerStage > 30) return 'slow';
  return 'normal';
}

/**
 * Get health score factors breakdown
 */
export function getHealthFactors(
  recentActivityScore: number,
  collaboratorCount: number,
  daysUntilExpectedClose: number | null,
  probability: number
): DealMetrics['healthFactors'] {
  return {
    recentActivity: Math.min(20, recentActivityScore),
    collaborators: Math.min(15, collaboratorCount * 3),
    expectedClose: daysUntilExpectedClose !== null && daysUntilExpectedClose > 0 && daysUntilExpectedClose <= 14 ? 20 : 0,
    probability: probability >= 70 ? 15 : probability >= 50 ? 10 : 0
  };
}

/**
 * Calculate complete deal metrics
 */
export function calculateDealMetrics(
  deal: any,
  stageIndex: number,
  totalStages: number,
  collaboratorCount: number = 0,
  lastActivityDate: Date | null = null
): DealMetrics {
  const now = new Date();
  const createdDate = new Date(deal.createdAt);
  const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  let daysUntilExpectedClose: number | null = null;
  if (deal.expectedCloseDate) {
    const closeDate = new Date(deal.expectedCloseDate);
    daysUntilExpectedClose = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const hasRecentActivity = lastActivityDate 
    ? daysSinceCreated - Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) <= 3
    : false;

  const winProbability = calculateWinProbability(stageIndex, totalStages, deal.probability || 50);
  const healthScore = calculateHealthScore(deal, daysSinceCreated, hasRecentActivity, collaboratorCount, daysUntilExpectedClose);
  const riskLevel = calculateRiskLevel(healthScore, daysSinceCreated, daysUntilExpectedClose, deal.probability || 50);
  const expectedValue = deal.value.toNumber() * (deal.probability || 50) / 100;
  const velocityIndicator = calculateVelocityIndicator(daysSinceCreated, stageIndex, totalStages);
  const healthFactors = getHealthFactors(
    hasRecentActivity ? 15 : 0,
    collaboratorCount,
    daysUntilExpectedClose,
    deal.probability || 50
  );

  return {
    winProbability,
    healthScore,
    riskLevel,
    expectedValue,
    stageDuration: daysSinceCreated,
    overallDuration: daysSinceCreated,
    velocityIndicator,
    healthFactors
  };
}
