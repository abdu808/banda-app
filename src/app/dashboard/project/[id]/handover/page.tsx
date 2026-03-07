'use client';

import { useParams } from 'next/navigation';
import { HandoverView } from '@/components/features/HandoverView';

export default function ProjectHandoverPage() {
    const { id: projectId } = useParams();
    return <HandoverView projectId={projectId as string | string[]} backHref={`/dashboard/project/${projectId}`} />;
}
