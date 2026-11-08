import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GektaTopicPage } from '@/components/gekta/GektaTopicPage';
import { GEKTA_TOPICS, getGektaTopic } from '@/lib/gekta/content';
import { getGektaTopicMetadata } from '@/lib/gekta/seo';

export const dynamicParams = false;

type PageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export function generateStaticParams() {
  return GEKTA_TOPICS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = getGektaTopic(slug);
  return topic ? getGektaTopicMetadata(topic) : {};
}

export default async function GektaTopicRoute({ params }: PageProps) {
  const { slug } = await params;
  const topic = getGektaTopic(slug);
  if (!topic) notFound();
  return <GektaTopicPage topic={topic} />;
}
