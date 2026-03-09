import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { ProjectsClient } from "@/components/dashboard/ProjectsClient";
import { describeApiError } from "@/lib/api";
import { fetchProjectsList } from "@/lib/dashboard-data";

export default async function ProjectsPage() {
  try {
    const projects = await fetchProjectsList();
    return <ProjectsClient projects={projects} />;
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Projects"
        subheading="Repositories connected to your rule sets"
        title={description.title}
        description={description.description}
      />
    );
  }
}
