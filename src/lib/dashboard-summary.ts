export function generateWeaknessSummary(dashboard: any) {
  const points: string[] = [];
  const weakCount = dashboard.totals?.weakTopics || 0;
  const assessed = dashboard.totals?.assessedTopics || 0;
  const subjects = dashboard.subjects || [];
  
  if (weakCount === 0 && assessed === 0) {
    points.push("Start with uploading study materials and taking your first diagnostic to identify gaps.");
    points.push("Create a subject and add your syllabus, notes, or past papers.");
    points.push("Once you complete a diagnostic, you'll see personalized insights here.");
    points.push("Use BUDDY to ask questions about topics you're unsure of.");
    points.push("Focus on building your knowledge base first.");
    points.push("Review the topic map after uploading materials.");
    points.push("Plan your study schedule based on upcoming exams.");
    points.push("Check back after your first assessment for detailed recommendations.");
    return points.slice(0, 8);
  }
  
  if (weakCount > 0) {
    points.push(`You have ${weakCount} weak topic${weakCount === 1 ? '' : 's'} that need immediate attention.`);
  }
  
  const worstSubject = subjects.reduce((prev: any, curr: any) => 
    ((curr.weakTopics || 0) > (prev.weakTopics || 0)) ? curr : prev, subjects[0]);
  
  if (worstSubject && (worstSubject.weakTopics || 0) > 0) {
    points.push(`Focus most on "${worstSubject.name}" - it has the highest number of weak areas.`);
  }
  
  if (assessed < (dashboard.totals?.subjects || 1) * 2) {
    points.push("Take more diagnostics across different topics to get a complete picture of your gaps.");
  }
  
  if ((dashboard.totals?.pendingTasks || 0) === 0 && weakCount > 0) {
    points.push("Generate a revision plan to turn your weak areas into actionable tasks.");
  }
  
  if ((dashboard.totals?.readyDocuments || 0) < 2) {
    points.push("Add more study materials (notes, past papers) for better-grounded explanations and questions.");
  }
  
  points.push("Practice actively with diagnostics rather than just re-reading - retrieval practice is more effective.");
  points.push("Review citations and sources when using BUDDY to understand concepts deeply.");
  
  return points.slice(0, 8);
}
