import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Edit,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  programmesService,
  type ProgrammeCourse,
  type ProgrammeDetail,
} from '@/services/programmes.service';
import { CourseModal, type CourseFormValues } from './CourseModal';

export function ProgrammeCurriculumTab({
  programme,
  canManage,
}: {
  programme: ProgrammeDetail;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; course: ProgrammeCourse } | null
  >(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['programmes', 'detail'] });
    queryClient.invalidateQueries({ queryKey: ['programmes', 'list'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: CourseFormValues) =>
      programmesService.addCourse(programme.id, values),
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast.success('Course added');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to add course');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      courseId,
      values,
    }: {
      courseId: string;
      values: CourseFormValues;
    }) => programmesService.updateCourse(programme.id, courseId, values),
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast.success('Course updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update course');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) =>
      programmesService.deleteCourse(programme.id, courseId),
    onSuccess: () => {
      invalidate();
      toast.success('Course removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to remove course');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (courseIds: string[]) =>
      programmesService.reorderCourses(programme.id, courseIds),
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to reorder courses');
    },
  });

  const courses = programme.courses;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= courses.length) return;
    const ids = courses.map((course) => course.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Curriculum ({courses.length})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            The courses a learner must complete for this programme
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add course
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No courses yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Add the first course to start building the curriculum.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {courses.map((course, index) => (
            <div
              key={course.id}
              className="flex items-start gap-4 px-5 py-3.5 group"
            >
              <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-gray-500 tabular-nums mt-0.5">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-gray-900">
                    {course.title}
                  </span>
                  {course.code && (
                    <span className="text-[10px] font-mono text-gray-400">
                      {course.code}
                    </span>
                  )}
                  {course.is_optional && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
                      Optional
                    </span>
                  )}
                </div>
                {course.description && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                    {course.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                  {course.contact_hours != null && (
                    <span>{course.contact_hours} contact hours</span>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton
                    title="Move up"
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton
                    title="Move down"
                    disabled={
                      index === courses.length - 1 || reorderMutation.isPending
                    }
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton
                    title="Edit course"
                    onClick={() => setModal({ mode: 'edit', course })}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton
                    title="Remove course"
                    danger
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove "${course.title}" from the curriculum?`,
                        )
                      ) {
                        deleteMutation.mutate(course.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CourseModal
          initial={modal.mode === 'edit' ? modal.course : undefined}
          isSaving={isSaving}
          onClose={() => setModal(null)}
          onSave={(values) => {
            if (modal.mode === 'edit') {
              updateMutation.mutate({ courseId: modal.course.id, values });
            } else {
              createMutation.mutate(values);
            }
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  title,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? 'p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30'
          : 'p-1.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30'
      }
    >
      {children}
    </button>
  );
}
