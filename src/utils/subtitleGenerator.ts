/**
 * Generates and downloads an SRT subtitle file from Bengali script text and audio duration.
 */
export function generateSrtContent(scriptText: string = '', totalDuration: number = 5): string {
  if (!scriptText || !scriptText.trim()) {
    return '1\n00:00:00,000 --> 00:00:05,000\n[Bangla Audio]\n';
  }

  // Split text into meaningful phrases or sentences
  const rawSegments = scriptText
    .split(/([।!?\n\r]+)/)
    .reduce<string[]>((acc, part, idx, arr) => {
      if (idx % 2 === 0 && part.trim()) {
        const punctuation = arr[idx + 1] ? arr[idx + 1].trim() : '';
        acc.push((part.trim() + ' ' + punctuation).trim());
      }
      return acc;
    }, [])
    .filter((s) => s.length > 0);

  // If punctuation split yielded very few or no segments, split by comma or words
  let segments = rawSegments;
  if (segments.length <= 1 && scriptText.length > 60) {
    segments = scriptText
      .split(/([,;]+)/)
      .reduce<string[]>((acc, part, idx, arr) => {
        if (idx % 2 === 0 && part.trim()) {
          const punctuation = arr[idx + 1] ? arr[idx + 1].trim() : '';
          acc.push((part.trim() + ' ' + punctuation).trim());
        }
        return acc;
      }, [])
      .filter((s) => s.length > 0);
  }

  if (segments.length === 0) {
    segments = [scriptText.trim()];
  }

  const duration = totalDuration > 0 ? totalDuration : segments.length * 2.5;
  const totalChars = segments.reduce((sum, s) => sum + s.length, 0);

  let currentTime = 0;
  let srtOutput = '';

  segments.forEach((seg, index) => {
    // Proportional segment duration with minimum bounds
    const segRatio = totalChars > 0 ? seg.length / totalChars : 1 / segments.length;
    const segDuration = Math.max(1.0, duration * segRatio);
    const startTime = currentTime;
    const endTime = Math.min(duration, startTime + segDuration);

    srtOutput += `${index + 1}\n`;
    srtOutput += `${formatSrtTimestamp(startTime)} --> ${formatSrtTimestamp(endTime)}\n`;
    srtOutput += `${seg}\n\n`;

    currentTime = endTime;
  });

  return srtOutput;
}

function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

export function downloadSrtFile(
  scriptText?: string,
  duration?: number,
  filename: string = 'subtitle.srt'
): void {
  const content = generateSrtContent(scriptText, duration);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.srt') ? filename : `${filename}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
