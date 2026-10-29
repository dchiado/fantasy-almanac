// "A", "A and B", "A, B, and C": a list in a sentence, with the Oxford comma
export const listText = (parts) => {
  if (parts.length <= 2) {
    return parts.join(' and ');
  }

  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
};
