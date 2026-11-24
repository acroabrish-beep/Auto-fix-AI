import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../hooks/useRole';
import { COLLECTIONS, Query } from '../../services/database/index';
import { studentsService } from '../../services/database/students';
import { Course } from '../../types';
import { Loader2, AlertCircle, CheckCircle, Clock, BarChart, Users, Settings, FileText, FolderOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface DepartmentAdminDashboardProps {
  departmentId?: string;
}

export const DepartmentAdminDashboard: React.FC<DepartmentAdminDashboardProps> = ({ departmentId }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { role, isTvetAdmin, isInstructor, isStudent, isGarageAdmin, isDepartmentAdmin } = useRole();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive departmentId from prop or profile (fail-closed: never invent a department ID)
  const effectiveDepartmentId = departmentId || (profile?.departmentId ?? '');

  // Verify department admin access - must own this department
  useEffect(() => {
    if (!profile || profile.role !== 'department_admin') {
      return;
    }
    // Verify the profile's departmentId matches the route departmentId
    if (profile.departmentId !== effectiveDepartmentId) {
      setLoading(false);
      return;
    }
  }, [profile, effectiveDepartmentId]);

  // Load department students
  useEffect(() => {
    if (!profile || profile.role !== 'department_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    studentsService.listStudentsByDepartment(effectiveDepartmentId)
      .then((result) => {
        setStudents(result || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load department students:', error);
        setStudents([]);
        setLoading(false);
      });
  }, [effectiveDepartmentId, profile]);

  

  if (loading || !profile) {
    return (
      <div className='min-h-screen bg-white p-8'>
        <div className='max-w-2xl mx-auto text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-brand-blue mb-4' />
          <h2 className='text-2xl font-bold text-brand-navy mb-2'>
            {t('department_admin.loading_dashboard')}
          </h2>
          <p className='text-slate-500'>
            {t('department_admin.loading_students')}
          </p>
        </div>
      </div>
    );
  }

  if (profile.role !== 'department_admin') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-white'>
        <div className='max-w-md text-center'>
          <h1 className='text-2xl font-bold text-brand-navy mb-2'>
            403 Unauthorized
          </h1>
          <p className='text-slate-600'>
            {t('department_admin.unauthorized_access')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white min-h-screen p-6'>
      <div className='max-w-7xl mx-auto'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-brand-navy mb-2'>
            {t('department_admin.department_dashboard')}
          </h1>
          <p className='text-slate-600'>
            {t('department_admin.your_department', { department: profile.departmentId || departmentId })}
          </p>
        </header>

        {/* Students Roster */}
        <div className='mt-8'>
          <h2 className='text-xl font-bold text-brand-navy mb-4'>
            {t('department_admin.student_roster')}
          </h2>
          {students.length === 0 ? (
            <div className='p-6 bg-slate-100 rounded-xl text-center'>
              <AlertCircle className='h-6 w-6 text-slate-400 mb-3' />
              <p className='text-slate-600'>
                {t('department_admin.no_students')}
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {students.map((student) => (
                <div
                  key={student.$id}
                  className='p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-brand-teal/30 transition-all'
                >
                  <div className='flex justify-between items-start mb-2'>
                    <span className='font-medium text-slate-800'>
                      {student.fullName || student.name || 'Unknown'}
                    </span>
                    <span className='text-xs text-slate-500'>
                      {student.role || 'student'}
                    </span>
                  </div>
                  <div className='text-xs text-slate-500'>
                    <strong>{t('department_email')}</strong>: {student.email || 'N/A'}
                  </div>
                  <div className='mt-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        // Navigate to student details
                      }}
                      className='text-sm'
                    >
                      {t('department_admin.view_details')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department Management Section */}
        <div className='mt-8'>
          <h2 className='text-xl font-bold text-brand-navy mb-4'>
            {t('department_admin.management')}
          </h2>

          {/* Instructor Assignment -->
          <div className='bg-white p-6 rounded-xl border border-slate-100 mb-6'>
            <h3 className='text-semibold text-slate-700 mb-3'>
              {t('department_admin.assign_instructor')}
            </h3>
            <p className='text-slate-500 text-sm mb-4'>
              {t('department_admin.assign_instructor_desc')}
            </p>
            <Button
              size='sm'
              variant='outline'
              disabled={true}
              className='w-full py-3 text-sm'
            >
              {t('department_admin.feature_coming_soon')}
            </Button>
          </div>

          {/* Student Engagement */}
          <div className='bg-white p-6 rounded-xl border border-slate-100'>
            <h3 className='text-semibold text-slate-700 mb-3'>
              {t('department_admin.engagement')}
            </h3>
            <p className='text-slate-500 text-sm mb-4'>
              {t('department_admin.engagement_desc')}
            </p>
          </div>

          {/* Reports */}
          <div className='bg-white p-6 rounded-xl border border-slate-100'>
            <h3 className='text-semibold text-slate-700 mb-3'>
              {t('department_admin.reports')}
            </h3>
            <p className='text-slate-500 text-sm mb-4'>
              {t('department_admin.reports_desc')}
            </p>
            <Button
              size='sm'
              variant='outline'
              className='w-full py-3 text-sm'
            >
              {t('department_admin.view_reports')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
