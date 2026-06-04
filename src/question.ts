/**
 *
 * NOTE: PLEASE USE PREFERRED LANGUAGE
 * 
 * Part 1: Most Frequent Secure Tag
 *
 * You are given an array of ExamItem objects.
 *
 * Implement the function `mostFrequentSecureTag`.
 *
 * Rules:
 * - Only consider items where:
 *     - securityLevel === "secure" OR
 *     - securityLevel === "highly-secure"
 * - Count every occurrence of every tag across those items.
 * - Return the tag that appears the most total times.
 * - If there is a tie, you may return any one of them.
 * - If there are no secure items, or no tags on secure items,
 *   return null.
 *
 * Example:
 *
 * const items = [
 *   {
 *     id: "1",
 *     securityLevel: "secure",
 *     metadata: { tags: ["algebra", "functions"] },
 *   },
 *   {
 *     id: "2",
 *     securityLevel: "highly-secure",
 *     metadata: { tags: ["algebra"] },
 *   },
 *   {
 *     id: "3",
 *     securityLevel: "standard",
 *     metadata: { tags: ["algebra"] },
 *   },
 * ];
 *
 * mostFrequentSecureTag(items); // "algebra"
 */

import { string } from "zod/v4";

/**
 * Minimal ExamItem shape needed for this exercise.
 */
export interface ExamItem {
  id: string;
  metadata: {
    tags: string[];
  };
  securityLevel: string; // "standard" | "secure" | "highly-secure"
}

export function mostFrequentSecureTag(
  items: ExamItem[]
): string | null {
  
  const counter = items.filter(i => ["secure", "highly-secure"].includes(i.securityLevel)).reduce((counter, item) => {
    for (const tag of item.metadata.tags) {
      counter[tag] ??= 0;
      counter[tag]++;
    }
    return counter;
  }, {} as Record<string, number>)

  const result = Object.entries(counter).reduce<[string|null, number]>((acc, [tag,count]) => acc[1] < count ? [tag, count] : acc, [null, 0])
  return result[0]
}






/**
 * --------------------------------------------------
 * Part 2 — Most Dominant Secure Tag
 * --------------------------------------------------
 *
 * Now implement `mostDominantSecureTag`.
 *
 * This time, instead of counting all tag occurrences globally:
 *
 * - For each secure item:
 *     - Determine which tag(s) appear most frequently
 *       within that item.
 *     - If there is a tie for most frequent tag within
 *       the item, that item contributes 1 "dominance vote"
 *       to EACH of the tied tags.
 * - After evaluating all secure items,
 *   return the tag with the most dominance votes.
 *
 * Notes:
 * - If there is a tie in total dominance votes across all items,
 *   you may return any one of the tied tags.
 * - If there are no secure items, or no tags on secure items,
 *   return null.
 *
 */

export function mostDominantSecureTag(
  items: ExamItem[]
): string | null {
    
  const dominance = items.filter(i => ["secure", "highly-secure"].includes(i.securityLevel)).reduce((dominance, item) => {
    
    // getting all the occurrences of tags for this item
    const counter = {} as Record<string,number>
    for (const tag of item.metadata.tags) {
      counter[tag] ??= 0;
      counter[tag]++;
    }

    // calculate whicih tags are the most dominant
    const entries = Object.entries(counter).sort((a,b) => b[1]-a[1]);
    const dominantTags = []
    const maxOccurrence = entries[0][1]
    for (const entry of entries) {
      if (entry[1] === maxOccurrence)
          dominantTags.push(entry[0])
      else break;
    }
    console.log(`${item.id}`, { entries, tags: dominantTags, maxOccurrence})
    for (const tag of dominantTags){
      dominance[tag] ??= 0;
      dominance[tag]++;
    }
    return dominance;
  }, {} as Record<string, number>)

  const result = Object.entries(dominance).reduce<[string|null, number]>((acc, [tag,count]) => acc[1] < count ? [tag, count] : acc, [null, 0])
  return result[0]
}


 const items = [
    {
      id: "1",
      securityLevel: "secure",
      metadata: { tags: ["algebra", "functions"] },
    },
    {
      id: "2",
      securityLevel: "highly-secure",
      metadata: { tags: ["algebra"] },
    },
    {
      id: "3",
      securityLevel: "standard",
      metadata: { tags: ["algebra"] },
    },
  ];
 
  console.log(mostDominantSecureTag(items)); 
