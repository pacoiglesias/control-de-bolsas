import React from 'react';
import { motion } from 'framer-motion';

export interface StepperProps {
  activeStep: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface StepProps {
  children?: React.ReactNode;
  completed?: boolean;
  active?: boolean;
  disabled?: boolean;
  stepIndex?: number;
}

export interface StepLabelProps {
  children: React.ReactNode;
  optional?: React.ReactNode;
  error?: boolean;
  stepIndex?: number;
  active?: boolean;
  completed?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({
  activeStep,
  children,
  className = '',
  style = {},
}) => {
  const childArray = React.Children.toArray(children);

  return (
    <div
      className={`cb-stepper ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '16px 8px',
        position: 'relative',
        ...style,
      }}
    >
      {childArray.map((child, index) => {
        if (!React.isValidElement(child)) return null;

        const isCompleted = index < activeStep;
        const isActive = index === activeStep;

        return (
          <React.Fragment key={index}>
            {React.cloneElement(child as React.ReactElement<any>, {
              stepIndex: index,
              completed: isCompleted,
              active: isActive,
            })}
            {index < childArray.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 3,
                  margin: '0 12px',
                  background: isCompleted ? 'var(--ok)' : 'var(--line-soft)',
                  borderRadius: 2,
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const Step: React.FC<StepProps> = ({
  children,
  completed,
  active,
  stepIndex,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child as React.ReactElement<any>, {
          completed,
          active,
          stepIndex,
        });
      })}
    </div>
  );
};

export const StepLabel: React.FC<StepLabelProps> = ({
  children,
  optional,
  active,
  completed,
  stepIndex = 0,
}) => {
  const stepNumber = stepIndex + 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <motion.div
        animate={{
          scale: active ? 1.08 : 1,
          backgroundColor: completed
            ? 'var(--ok)'
            : active
            ? 'var(--accent)'
            : 'var(--paper-sunk)',
          color: completed || active ? '#ffffff' : 'var(--ink-soft)',
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          boxShadow: active ? '0 0 0 4px var(--accent-tint)' : 'none',
        }}
      >
        {completed ? '✓' : stepNumber}
      </motion.div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: active ? 700 : completed ? 600 : 500,
            color: active ? 'var(--ink)' : completed ? 'var(--ink-soft)' : 'var(--ink-faint)',
            transition: 'color 0.2s',
          }}
        >
          {children}
        </span>
        {optional && (
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {optional}
          </span>
        )}
      </div>
    </div>
  );
};
