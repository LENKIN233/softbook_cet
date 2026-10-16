import {inlineTextSegments} from '../../mobile/src/learning/inlineText';
export function CardText({text}: {text: string}) {
  return <>{inlineTextSegments(text).map((segment, index) => segment.strong ? <strong key={index}>{segment.text}</strong> : segment.text)}</>;
}
